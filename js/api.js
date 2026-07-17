/* =====================================================
   ANILIST CONFIGURATION
===================================================== */

const ANILIST_API =
  "https://graphql.anilist.co";

const ANILIST_PAGE_SIZE = 24;
const ANILIST_BATCH_SIZE = 50;

const ANILIST_MAX_RETRIES = 3;
const ANILIST_RETRY_DELAY = 1000;
const ANILIST_REQUEST_DELAY = 250;

/* =====================================================
   ANILIST FIELDS
===================================================== */

const ANIME_FIELDS = `
  fragment AnimeFields on Media {
    id

    title {
      english
      romaji
    }

    coverImage {
      extraLarge
      large
    }

    bannerImage
    averageScore
    episodes
    genres
    format
    status
    seasonYear

    relations {
      edges {
        relationType(version: 2)

        node {
          id
          type
          format
          status
          seasonYear
          episodes

          title {
            english
            romaji
          }

          coverImage {
            extraLarge
            large
          }

          bannerImage
          averageScore
          genres
        }
      }
    }
  }
`;

/* =====================================================
   GRAPHQL QUERIES
===================================================== */

const POPULAR_ANIME_QUERY = `
  ${ANIME_FIELDS}

  query PopularAnime(
    $page: Int
    $perPage: Int
  ) {
    Page(
      page: $page
      perPage: $perPage
    ) {
      pageInfo {
        currentPage
        hasNextPage
      }

      media(
        type: ANIME
        sort: POPULARITY_DESC
      ) {
        ...AnimeFields
      }
    }
  }
`;

const ANIME_BY_ID_QUERY = `
  ${ANIME_FIELDS}

  query AnimeById($id: Int) {
    Media(
      id: $id
      type: ANIME
    ) {
      ...AnimeFields
    }
  }
`;

const ANIME_BY_IDS_QUERY = `
  ${ANIME_FIELDS}

  query AnimeByIds(
    $ids: [Int]
    $perPage: Int
  ) {
    Page(
      page: 1
      perPage: $perPage
    ) {
      media(
        id_in: $ids
        type: ANIME
      ) {
        ...AnimeFields
      }
    }
  }
`;

/* =====================================================
   API CACHE
===================================================== */

const animeApiCache = new Map();
const popularAnimePageCache = new Map();

const activeAnimeRequests = new Map();
const activePopularRequests = new Map();

/* =====================================================
   REQUEST QUEUE
===================================================== */

let anilistRequestQueue =
  Promise.resolve();

let lastAniListRequestTime = 0;

function wait(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function queueAniListRequest(requestFunction) {
  const queuedRequest =
    anilistRequestQueue.then(
      async () => {
        const currentTime = Date.now();

        const elapsedTime =
          currentTime -
          lastAniListRequestTime;

        const remainingDelay =
          ANILIST_REQUEST_DELAY -
          elapsedTime;

        if (remainingDelay > 0) {
          await wait(remainingDelay);
        }

        lastAniListRequestTime =
          Date.now();

        return requestFunction();
      }
    );

  /*
    Keep the queue alive even when one request fails.
    The caller still receives the original rejection.
  */
  anilistRequestQueue =
    queuedRequest.catch(() => {});

  return queuedRequest;
}

/* =====================================================
   ERROR HELPERS
===================================================== */

function createAniListError(
  message,
  status = 0,
  retryAfterMs = null
) {
  const error = new Error(message);

  error.name = "AniListError";
  error.status = status;
  error.retryAfterMs = retryAfterMs;

  return error;
}

function getRetryAfterMilliseconds(
  response
) {
  const retryAfter =
    response.headers.get(
      "Retry-After"
    );

  if (!retryAfter) {
    return null;
  }

  const seconds =
    Number(retryAfter);

  if (Number.isFinite(seconds)) {
    return seconds * 1000;
  }

  const retryDate =
    Date.parse(retryAfter);

  if (
    Number.isNaN(retryDate)
  ) {
    return null;
  }

  return Math.max(
    retryDate - Date.now(),
    0
  );
}

function shouldRetryAniListRequest(
  error
) {
  return (
    error.status === 429 ||
    error.status === 408 ||
    error.status >= 500 ||
    error.name === "TypeError"
  );
}

function getRetryDelay(
  attempt,
  error
) {
  if (error.retryAfterMs) {
    return error.retryAfterMs;
  }

  return (
    ANILIST_RETRY_DELAY *
    Math.pow(2, attempt)
  );
}

/* =====================================================
   CORE ANILIST REQUEST
===================================================== */

async function performAniListRequest(
  query,
  variables
) {
  let response;

  try {
    response = await fetch(
      ANILIST_API,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",

          Accept:
            "application/json",
        },

        body: JSON.stringify({
          query,
          variables,
        }),
      }
    );
  } catch (error) {
    const networkError =
      createAniListError(
        "Could not connect to AniList."
      );

    networkError.name =
      "TypeError";

    throw networkError;
  }

  const responseText =
    await response.text();

  let responseData;

  try {
    responseData =
      JSON.parse(responseText);
  } catch (error) {
    throw createAniListError(
      `AniList returned an invalid response (${response.status}).`,
      response.status,
      getRetryAfterMilliseconds(
        response
      )
    );
  }

  if (
    !response.ok ||
    responseData.errors
  ) {
    console.error(
      "AniList API error:",
      responseData.errors ||
        responseData
    );

    const message =
      responseData.errors?.[0]
        ?.message ||
      `AniList request failed (${response.status}).`;

    throw createAniListError(
      message,
      response.status,
      getRetryAfterMilliseconds(
        response
      )
    );
  }

  if (!responseData.data) {
    throw createAniListError(
      "AniList returned no data.",
      response.status
    );
  }

  return responseData.data;
}

async function anilistRequest(
  query,
  variables = {},
  options = {}
) {
  const maxRetries =
    options.maxRetries ??
    ANILIST_MAX_RETRIES;

  let lastError;

  for (
    let attempt = 0;
    attempt <= maxRetries;
    attempt += 1
  ) {
    try {
      return await queueAniListRequest(
        () =>
          performAniListRequest(
            query,
            variables
          )
      );
    } catch (error) {
      lastError = error;

      const retriesRemaining =
        attempt < maxRetries;

      if (
        !retriesRemaining ||
        !shouldRetryAniListRequest(
          error
        )
      ) {
        throw error;
      }

      const retryDelay =
        getRetryDelay(
          attempt,
          error
        );

      console.warn(
        `AniList request failed. Retrying in ${retryDelay}ms...`,
        error
      );

      await wait(retryDelay);
    }
  }

  throw lastError;
}

/* =====================================================
   CACHE HELPERS
===================================================== */

function cacheAnime(anime) {
  if (!anime?.id) return;

  animeApiCache.set(
    anime.id,
    anime
  );
}

function cacheAnimeList(animeList) {
  if (!Array.isArray(animeList)) {
    return;
  }

  animeList.forEach(cacheAnime);
}

function getCachedAnime(id) {
  return (
    animeApiCache.get(id) ||
    null
  );
}

/* =====================================================
   POPULAR ANIME
===================================================== */

async function getPopularAnime(
  page = 1
) {
  const normalizedPage =
    Math.max(
      1,
      Number(page) || 1
    );

  if (
    popularAnimePageCache.has(
      normalizedPage
    )
  ) {
    return popularAnimePageCache.get(
      normalizedPage
    );
  }

  if (
    activePopularRequests.has(
      normalizedPage
    )
  ) {
    return activePopularRequests.get(
      normalizedPage
    );
  }

  const request =
    anilistRequest(
      POPULAR_ANIME_QUERY,
      {
        page: normalizedPage,
        perPage:
          ANILIST_PAGE_SIZE,
      }
    )
      .then((data) => {
        const animeList =
          data.Page?.media || [];

        cacheAnimeList(animeList);

        popularAnimePageCache.set(
          normalizedPage,
          animeList
        );

        return animeList;
      })
      .finally(() => {
        activePopularRequests.delete(
          normalizedPage
        );
      });

  activePopularRequests.set(
    normalizedPage,
    request
  );

  return request;
}

/* =====================================================
   SINGLE ANIME
===================================================== */

async function getAnimeById(id) {
  const animeId = Number(id);

  if (!animeId) {
    throw new Error(
      "A valid anime ID is required."
    );
  }

  const cachedAnime =
    getCachedAnime(animeId);

  /*
    Popular catalog results already contain the
    complete AnimeFields fragment, so they can
    safely be returned from the cache.
  */
  if (cachedAnime) {
    return cachedAnime;
  }

  if (
    activeAnimeRequests.has(
      animeId
    )
  ) {
    return activeAnimeRequests.get(
      animeId
    );
  }

  const request =
    anilistRequest(
      ANIME_BY_ID_QUERY,
      {
        id: animeId,
      }
    )
      .then((data) => {
        const anime =
          data.Media;

        if (!anime) {
          throw new Error(
            `Anime ${animeId} was not found.`
          );
        }

        cacheAnime(anime);

        return anime;
      })
      .finally(() => {
        activeAnimeRequests.delete(
          animeId
        );
      });

  activeAnimeRequests.set(
    animeId,
    request
  );

  return request;
}

/* =====================================================
   MULTIPLE ANIME
===================================================== */

function splitIntoBatches(
  items,
  batchSize
) {
  const batches = [];

  for (
    let index = 0;
    index < items.length;
    index += batchSize
  ) {
    batches.push(
      items.slice(
        index,
        index + batchSize
      )
    );
  }

  return batches;
}

async function requestAnimeBatch(ids) {
  const data =
    await anilistRequest(
      ANIME_BY_IDS_QUERY,
      {
        ids,
        perPage: ids.length,
      }
    );

  const animeList =
    data.Page?.media || [];

  cacheAnimeList(animeList);

  return animeList;
}

async function getAnimeByIds(ids) {
  if (!Array.isArray(ids)) {
    return [];
  }

  const uniqueIds = [
    ...new Set(
      ids
        .map(Number)
        .filter(Boolean)
    ),
  ];

  if (!uniqueIds.length) {
    return [];
  }

  const animeById =
    new Map();

  const missingIds = [];

  uniqueIds.forEach((id) => {
    const cachedAnime =
      getCachedAnime(id);

    if (cachedAnime) {
      animeById.set(
        id,
        cachedAnime
      );
    } else {
      missingIds.push(id);
    }
  });

  const batches =
    splitIntoBatches(
      missingIds,
      ANILIST_BATCH_SIZE
    );

  /*
    Batches run sequentially through AniList's
    request queue to reduce rate-limit errors.
  */
  for (const batch of batches) {
    const animeList =
      await requestAnimeBatch(
        batch
      );

    animeList.forEach(
      (anime) => {
        animeById.set(
          anime.id,
          anime
        );
      }
    );
  }

  /*
    Return results in the same order as the
    IDs originally supplied.
  */
  return uniqueIds
    .map((id) =>
      animeById.get(id)
    )
    .filter(Boolean);
}

/* =====================================================
   CACHE MANAGEMENT
===================================================== */

function clearAniListCache() {
  animeApiCache.clear();
  popularAnimePageCache.clear();

  activeAnimeRequests.clear();
  activePopularRequests.clear();
}