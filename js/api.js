const ANILIST_API = "https://graphql.anilist.co";

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

          averageScore
        }
      }
    }
  }
`;

async function anilistRequest(query, variables = {}) {
  const response = await fetch(ANILIST_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      variables,
    }),
  });

  const responseText = await response.text();

  let data;

  try {
    data = JSON.parse(responseText);
  } catch (error) {
    const requestError = new Error(
      `AniList returned an invalid response (${response.status})`
    );

    requestError.status = response.status;
    throw requestError;
  }

  if (!response.ok || data.errors) {
    console.error("AniList error:", data.errors || data);

    const requestError = new Error(
      data.errors?.[0]?.message || "AniList request failed"
    );

    requestError.status = response.status;

    const retryAfter = Number(
      response.headers.get("Retry-After")
    );

    requestError.retryAfterMs = retryAfter
      ? retryAfter * 1000
      : null;

    throw requestError;
  }

  return data.data;
}

async function getPopularAnime(page = 1) {
  const query = `
    ${ANIME_FIELDS}

    query ($page: Int) {
      Page(page: $page, perPage: 24) {
        media(type: ANIME, sort: POPULARITY_DESC) {
          ...AnimeFields
        }
      }
    }
  `;

  const data = await anilistRequest(query, {
    page,
  });

  return data.Page.media;
}

async function getAnimeById(id) {
  const query = `
    ${ANIME_FIELDS}

    query ($id: Int) {
      Media(id: $id, type: ANIME) {
        ...AnimeFields
      }
    }
  `;

  const data = await anilistRequest(query, {
    id,
  });

  return data.Media;
}

async function getAnimeByIds(ids) {
  if (!Array.isArray(ids) || ids.length === 0) {
    return [];
  }

  const uniqueIds = [...new Set(ids)].slice(0, 50);

  const query = `
    ${ANIME_FIELDS}

    query ($ids: [Int]) {
      Page(page: 1, perPage: 50) {
        media(id_in: $ids, type: ANIME) {
          ...AnimeFields
        }
      }
    }
  `;

  const data = await anilistRequest(query, {
    ids: uniqueIds,
  });

  return data.Page.media;
}