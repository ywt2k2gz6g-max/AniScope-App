/* =====================================================
   FRANCHISE CONFIGURATION
===================================================== */

const franchiseAnimeCache = new Map();
const fullFranchiseCache = new Map();

const FRANCHISE_RELATION_TYPES = new Set([
  "PREQUEL",
  "SEQUEL",
  "PARENT",
  "SIDE_STORY",
  "SPIN_OFF",
  "SUMMARY",
  "ALTERNATIVE",
  "COMPILATION",
  "CONTAINS",
]);

const MAIN_STORY_RELATION_TYPES = new Set([
  "ROOT",
  "PREQUEL",
  "SEQUEL",
  "PARENT",
]);

const SPIN_OFF_RELATION_TYPES = new Set([
  "SIDE_STORY",
  "SPIN_OFF",
]);

const FRANCHISE_BATCH_SIZE = 10;
const FRANCHISE_MAX_ENTRIES = 60;

/* =====================================================
   BASIC HELPERS
===================================================== */

function getAnimeTitle(anime) {
  return (
    anime?.title?.english ||
    anime?.title?.romaji ||
    "Unknown Anime"
  );
}

function getAnimeCover(anime) {
  return (
    anime?.coverImage?.extraLarge ||
    anime?.coverImage?.large ||
    ""
  );
}

function getAnimeYear(anime) {
  return (
    anime?.seasonYear ??
    Number.MAX_SAFE_INTEGER
  );
}

function getFranchiseEntryCount(franchise) {
  return Object.values(franchise.content)
    .reduce((total, entries) => {
      return total + entries.length;
    }, 0);
}

function getAllFranchiseEntries(franchise) {
  return Object.values(franchise.content)
    .flat();
}

/* =====================================================
   CATEGORY LOGIC
===================================================== */

function getFranchiseCategory(
  anime,
  relationType = "ROOT"
) {
  if (
    SPIN_OFF_RELATION_TYPES.has(
      relationType
    )
  ) {
    return "spinOffs";
  }

  if (anime.format === "MOVIE") {
    return "movies";
  }

  if (
    anime.format === "OVA" ||
    anime.format === "SPECIAL" ||
    anime.format === "MUSIC"
  ) {
    return "specials";
  }

  /*
    ONA can be a full main series, so it should
    not automatically be treated as a special.
  */
  if (
    MAIN_STORY_RELATION_TYPES.has(
      relationType
    ) &&
    (
      anime.format === "TV" ||
      anime.format === "TV_SHORT" ||
      anime.format === "ONA"
    )
  ) {
    return "mainStory";
  }

  if (
    relationType === "SUMMARY" ||
    relationType === "COMPILATION"
  ) {
    return "specials";
  }

  if (
    MAIN_STORY_RELATION_TYPES.has(
      relationType
    )
  ) {
    return "mainStory";
  }

  return "other";
}

/* =====================================================
   FRANCHISE OBJECT
===================================================== */

function createFranchiseObject(rootAnime) {
  return {
    id: rootAnime.id,
    rootId: rootAnime.id,

    title: getAnimeTitle(rootAnime),

    artwork: {
      cover: getAnimeCover(rootAnime),
      banner:
        rootAnime.bannerImage || "",
    },

    averageScore:
      rootAnime.averageScore || null,

    genres:
      rootAnime.genres || [],

    status:
      rootAnime.status || null,

    content: {
      mainStory: [],
      movies: [],
      specials: [],
      spinOffs: [],
      other: [],
    },

    statistics: {
      totalEntries: 0,
      mainEntries: 0,
      movies: 0,
      specials: 0,
      spinOffs: 0,
      other: 0,
      totalEpisodes: 0,
    },

    releaseOrder: [],
    watchOrder: [],

    badges: [],
    insights: [],

    discovery: {
      entriesFound: 0,
      reachedSafetyLimit: false,
      incompleteEntries: 0,
    },
  };
}

/* =====================================================
   ENTRY MANAGEMENT
===================================================== */

function franchiseContainsAnime(
  franchise,
  animeId
) {
  return getAllFranchiseEntries(
    franchise
  ).some((entry) => {
    return entry.id === animeId;
  });
}

function createFranchiseEntry(
  anime,
  relationType
) {
  return {
    ...anime,

    relationType:
      relationType || "ROOT",

    displayTitle:
      getAnimeTitle(anime),

    displayCover:
      getAnimeCover(anime),
  };
}

function addEntryToFranchise(
  franchise,
  anime,
  relationType = "ROOT"
) {
  if (!anime?.id) return false;

  if (
    franchiseContainsAnime(
      franchise,
      anime.id
    )
  ) {
    return false;
  }

  const category =
    getFranchiseCategory(
      anime,
      relationType
    );

  const entry =
    createFranchiseEntry(
      anime,
      relationType
    );

  franchise.content[
    category
  ].push(entry);

  return true;
}

/* =====================================================
   SORTING
===================================================== */

function getFormatPriority(format) {
  const priorities = {
    TV: 0,
    TV_SHORT: 1,
    ONA: 2,
    MOVIE: 3,
    OVA: 4,
    SPECIAL: 5,
    MUSIC: 6,
  };

  return priorities[format] ?? 99;
}

function sortFranchiseEntries(
  firstAnime,
  secondAnime
) {
  const yearDifference =
    getAnimeYear(firstAnime) -
    getAnimeYear(secondAnime);

  if (yearDifference !== 0) {
    return yearDifference;
  }

  const formatDifference =
    getFormatPriority(
      firstAnime.format
    ) -
    getFormatPriority(
      secondAnime.format
    );

  if (formatDifference !== 0) {
    return formatDifference;
  }

  return (
    firstAnime.id -
    secondAnime.id
  );
}

function sortAllFranchiseContent(
  franchise
) {
  Object.values(
    franchise.content
  ).forEach((entries) => {
    entries.sort(
      sortFranchiseEntries
    );
  });

  franchise.releaseOrder =
    getAllFranchiseEntries(
      franchise
    ).sort(
      sortFranchiseEntries
    );
}

/* =====================================================
   WATCH ORDER
===================================================== */

function buildWatchOrder(franchise) {
  /*
    For now, the safest default watch order is:
    main story first, then movies, specials,
    spin-offs, and other related content.

    Later we can add curated franchise-specific
    watch orders without changing the UI.
  */

  franchise.watchOrder = [
    ...franchise.content.mainStory,
    ...franchise.content.movies,
    ...franchise.content.specials,
    ...franchise.content.spinOffs,
    ...franchise.content.other,
  ];
}

/* =====================================================
   STATISTICS
===================================================== */

function updateFranchiseStatistics(
  franchise
) {
  const stats =
    franchise.statistics;

  stats.mainEntries =
    franchise.content.mainStory.length;

  stats.movies =
    franchise.content.movies.length;

  stats.specials =
    franchise.content.specials.length;

  stats.spinOffs =
    franchise.content.spinOffs.length;

  stats.other =
    franchise.content.other.length;

  stats.totalEntries =
    getFranchiseEntryCount(
      franchise
    );

  /*
    Total episodes currently represents the
    main storyline only. Movies and specials
    are tracked separately.
  */
  stats.totalEpisodes =
    franchise.content.mainStory.reduce(
      (total, anime) => {
        return (
          total +
          (anime.episodes || 0)
        );
      },
      0
    );
}

/* =====================================================
   FRANCHISE INSIGHTS
===================================================== */

function buildFranchiseInsights(
  franchise
) {
  const insights = [];
  const stats =
    franchise.statistics;

  if (stats.mainEntries > 1) {
    insights.push(
      `${stats.mainEntries} main-story entries`
    );
  }

  if (stats.movies > 0) {
    insights.push(
      `${stats.movies} ${
        stats.movies === 1
          ? "movie"
          : "movies"
      }`
    );
  }

  if (stats.specials > 0) {
    insights.push(
      `${stats.specials} special ${
        stats.specials === 1
          ? "entry"
          : "entries"
      }`
    );
  }

  if (stats.spinOffs > 0) {
    insights.push(
      `${stats.spinOffs} ${
        stats.spinOffs === 1
          ? "spin-off"
          : "spin-offs"
      }`
    );
  }

  if (stats.totalEpisodes >= 100) {
    insights.push(
      "Long-running franchise"
    );
  }

  if (
    franchise.averageScore >= 80
  ) {
    insights.push(
      "Highly rated franchise"
    );
  }

  franchise.insights = insights;
}

/* =====================================================
   RELATIONSHIP DISCOVERY
===================================================== */

function addRelationshipsToQueue(
  anime,
  queue,
  visitedIds,
  queuedIds
) {
  const relationships =
    anime.relations?.edges || [];

  relationships.forEach((edge) => {
    const relatedAnime =
      edge.node;

    const relationType =
      edge.relationType;

    if (!relatedAnime?.id) return;

    if (
      relatedAnime.type !== "ANIME"
    ) {
      return;
    }

    if (
      !FRANCHISE_RELATION_TYPES.has(
        relationType
      )
    ) {
      return;
    }

    if (
      visitedIds.has(
        relatedAnime.id
      )
    ) {
      return;
    }

    if (
      queuedIds.has(
        relatedAnime.id
      )
    ) {
      return;
    }

    queue.push({
      id: relatedAnime.id,
      relationType,
      preview: relatedAnime,
    });

    queuedIds.add(
      relatedAnime.id
    );
  });
}

/* =====================================================
   DATA FETCHING
===================================================== */

async function fetchFranchiseAnimeBatch(
  ids
) {
  if (!ids.length) {
    return [];
  }

  try {
    const animeList =
      await getAnimeByIds(ids);

    animeList.forEach((anime) => {
      franchiseAnimeCache.set(
        anime.id,
        anime
      );
    });

    return animeList;
  } catch (error) {
    /*
      api.js already handles queueing, retries,
      delays, and AniList rate limits.
    */
    console.error(
      "Franchise batch failed:",
      ids,
      error
    );

    return [];
  }
}

/* =====================================================
   CACHE HELPERS
===================================================== */

function getCachedFranchise(
  animeId
) {
  return (
    fullFranchiseCache.get(
      animeId
    ) || null
  );
}

function cacheCompleteFranchise(
  franchise
) {
  const entries =
    getAllFranchiseEntries(
      franchise
    );

  /*
    Cache the same completed franchise under
    every connected anime ID. Clicking any
    season then opens the cached franchise.
  */
  entries.forEach((entry) => {
    fullFranchiseCache.set(
      entry.id,
      franchise
    );
  });

  fullFranchiseCache.set(
    franchise.id,
    franchise
  );
}

/* =====================================================
   FRANCHISE ROOT SELECTION
===================================================== */

function chooseFranchiseRoot(
  franchise,
  fallbackAnime
) {
  const mainEntries =
    franchise.content.mainStory;

  if (!mainEntries.length) {
    return fallbackAnime;
  }

  return [...mainEntries].sort(
    sortFranchiseEntries
  )[0];
}

function updateFranchiseIdentity(
  franchise,
  fallbackAnime
) {
  const rootAnime =
    chooseFranchiseRoot(
      franchise,
      fallbackAnime
    );

  franchise.id =
    rootAnime.id;

  franchise.rootId =
    rootAnime.id;

  franchise.title =
    getAnimeTitle(rootAnime);

  franchise.artwork.cover =
    getAnimeCover(rootAnime) ||
    franchise.artwork.cover;

  franchise.artwork.banner =
    rootAnime.bannerImage ||
    franchise.artwork.banner;

  franchise.averageScore =
    rootAnime.averageScore ||
    franchise.averageScore;

  franchise.genres =
    rootAnime.genres?.length
      ? rootAnime.genres
      : franchise.genres;

  franchise.status =
    rootAnime.status ||
    franchise.status;
}

/* =====================================================
   FULL FRANCHISE BUILDER
===================================================== */

async function buildFullFranchise(
  rootAnime,
  maxEntries =
    FRANCHISE_MAX_ENTRIES
) {
  if (!rootAnime?.id) {
    throw new Error(
      "A valid root anime is required."
    );
  }

  const cachedFranchise =
    getCachedFranchise(
      rootAnime.id
    );

  if (cachedFranchise) {
    return cachedFranchise;
  }

  const franchise =
    createFranchiseObject(
      rootAnime
    );

  const visitedIds =
    new Set();

  const queuedIds =
    new Set([
      rootAnime.id,
    ]);

  const queue = [
    {
      id: rootAnime.id,
      relationType: "ROOT",
      preview: rootAnime,
    },
  ];

  franchiseAnimeCache.set(
    rootAnime.id,
    rootAnime
  );

  while (
    queue.length > 0 &&
    visitedIds.size < maxEntries
  ) {
    const availableSpaces =
      maxEntries -
      visitedIds.size;

    const batchSize =
      Math.min(
        FRANCHISE_BATCH_SIZE,
        availableSpaces,
        queue.length
      );

    const currentBatch =
      queue.splice(
        0,
        batchSize
      );

    const idsToFetch =
      currentBatch
        .map((item) => {
          return item.id;
        })
        .filter((id) => {
          return (
            !franchiseAnimeCache.has(
              id
            )
          );
        });

    await fetchFranchiseAnimeBatch(
      idsToFetch
    );

    for (
      const item of currentBatch
    ) {
      if (
        visitedIds.has(
          item.id
        )
      ) {
        continue;
      }

      const anime =
        franchiseAnimeCache.get(
          item.id
        ) ||
        item.preview;

      visitedIds.add(
        item.id
      );

      if (!anime) {
        franchise.discovery
          .incompleteEntries += 1;

        continue;
      }

      addEntryToFranchise(
        franchise,
        anime,
        item.relationType
      );

      addRelationshipsToQueue(
        anime,
        queue,
        visitedIds,
        queuedIds
      );
    }
  }

  sortAllFranchiseContent(
    franchise
  );

  updateFranchiseIdentity(
    franchise,
    rootAnime
  );

  buildWatchOrder(
    franchise
  );

  updateFranchiseStatistics(
    franchise
  );

  buildFranchiseInsights(
    franchise
  );

  if (
    typeof generateBadges ===
    "function"
  ) {
    franchise.badges =
      generateBadges(
        franchise
      );
  }

  franchise.discovery.entriesFound =
    visitedIds.size;

  franchise.discovery.reachedSafetyLimit =
    (
      visitedIds.size >=
      maxEntries
    ) &&
    queue.length > 0;

  cacheCompleteFranchise(
    franchise
  );

  return franchise;
}

/* =====================================================
   CACHE MANAGEMENT
===================================================== */

function clearFranchiseCache() {
  franchiseAnimeCache.clear();
  fullFranchiseCache.clear();
}