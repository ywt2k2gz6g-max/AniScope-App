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

const FRANCHISE_BATCH_SIZE = 10;
const FRANCHISE_REQUEST_DELAY = 2500;
const FRANCHISE_MAX_RETRIES = 2;

function wait(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function getAnimeTitle(anime) {
  return (
    anime.title?.english ||
    anime.title?.romaji ||
    "Unknown Anime"
  );
}

function getFranchiseCategory(
  anime,
  relationType = "ROOT"
) {
  if (
    relationType === "SIDE_STORY" ||
    relationType === "SPIN_OFF"
  ) {
    return "spinOffs";
  }

  if (anime.format === "MOVIE") {
    return "movies";
  }

  if (
    anime.format === "OVA" ||
    anime.format === "ONA" ||
    anime.format === "SPECIAL"
  ) {
    return "specials";
  }

  if (
    relationType === "ROOT" ||
    relationType === "PREQUEL" ||
    relationType === "SEQUEL" ||
    relationType === "PARENT"
  ) {
    return "mainStory";
  }

  return "other";
}

function createFranchiseObject(rootAnime) {
  return {
    id: rootAnime.id,
    title: getAnimeTitle(rootAnime),

    artwork: {
      cover:
        rootAnime.coverImage?.extraLarge ||
        rootAnime.coverImage?.large ||
        "",
      banner: rootAnime.bannerImage || "",
    },

    averageScore: rootAnime.averageScore || null,
    genres: rootAnime.genres || [],

    content: {
      mainStory: [],
      movies: [],
      specials: [],
      spinOffs: [],
      other: [],
    },

    statistics: {
      mainEntries: 0,
      movies: 0,
      specials: 0,
      spinOffs: 0,
      totalEpisodes: 0,
    },

    releaseOrder: [],
    watchOrder: [],
    badges: [],
    insights: [],

    discovery: {
      entriesFound: 0,
      reachedSafetyLimit: false,
    },
  };
}

function franchiseContainsAnime(franchise, animeId) {
  return Object.values(franchise.content)
    .flat()
    .some((entry) => entry.id === animeId);
}

function addEntryToFranchise(
  franchise,
  anime,
  relationType = "ROOT"
) {
  if (!anime || franchiseContainsAnime(franchise, anime.id)) {
    return;
  }

  const category = getFranchiseCategory(
    anime,
    relationType
  );

  franchise.content[category].push({
    ...anime,
    relationType,
  });
}

function updateFranchiseStatistics(franchise) {
  const stats = franchise.statistics;

  stats.mainEntries =
    franchise.content.mainStory.length;

  stats.movies =
    franchise.content.movies.length;

  stats.specials =
    franchise.content.specials.length;

  stats.spinOffs =
    franchise.content.spinOffs.length;

  stats.totalEpisodes =
    franchise.content.mainStory.reduce(
      (total, anime) => {
        return total + (anime.episodes || 0);
      },
      0
    );
}

function sortFranchiseEntries(
  firstAnime,
  secondAnime
) {
  const firstYear =
    firstAnime.seasonYear ??
    Number.MAX_SAFE_INTEGER;

  const secondYear =
    secondAnime.seasonYear ??
    Number.MAX_SAFE_INTEGER;

  if (firstYear !== secondYear) {
    return firstYear - secondYear;
  }

  return firstAnime.id - secondAnime.id;
}

function sortAllFranchiseContent(franchise) {
  Object.values(franchise.content).forEach(
    (category) => {
      category.sort(sortFranchiseEntries);
    }
  );

  franchise.releaseOrder = Object.values(
    franchise.content
  )
    .flat()
    .sort(sortFranchiseEntries);
}

function addRelationshipsToQueue(
  anime,
  queue,
  visitedIds,
  queuedIds
) {
  const relationships = anime.relations?.edges || [];

  relationships.forEach((edge) => {
    const relatedAnime = edge.node;
    const relationType = edge.relationType;

    if (!relatedAnime) return;

    if (relatedAnime.type !== "ANIME") return;

    if (!FRANCHISE_RELATION_TYPES.has(relationType)) {
      return;
    }

    if (visitedIds.has(relatedAnime.id)) return;
    if (queuedIds.has(relatedAnime.id)) return;

    queue.push({
      id: relatedAnime.id,
      relationType,
      preview: relatedAnime,
    });

    queuedIds.add(relatedAnime.id);
  });
}

async function fetchAnimeBatchWithRetry(ids) {
  for (
    let attempt = 0;
    attempt <= FRANCHISE_MAX_RETRIES;
    attempt += 1
  ) {
    try {
      const animeList = await getAnimeByIds(ids);

      animeList.forEach((anime) => {
        franchiseAnimeCache.set(anime.id, anime);
      });

      return animeList;
    } catch (error) {
      const finalAttempt =
        attempt === FRANCHISE_MAX_RETRIES;

      if (finalAttempt) {
        console.error(
          "Franchise batch failed:",
          ids,
          error
        );

        return [];
      }

      const retryDelay =
        error.retryAfterMs ||
        (attempt + 1) * 10000;

      console.warn(
        `AniList paused the request. Retrying in ${
          retryDelay / 1000
        } seconds.`
      );

      await wait(retryDelay);
    }
  }

  return [];
}

async function buildFullFranchise(
    rootAnime,
    maxEntries = 60
) {

    if (fullFranchiseCache.has(rootAnime.id)) {
        return fullFranchiseCache.get(rootAnime.id);
    }

    const franchise = createFranchiseObject(rootAnime);

    const visitedIds = new Set();
  const queuedIds = new Set([rootAnime.id]);

  const queue = [
    {
      id: rootAnime.id,
      relationType: "ROOT",
      preview: rootAnime,
    },
  ];

  franchiseAnimeCache.set(rootAnime.id, rootAnime);

  while (
    queue.length > 0 &&
    visitedIds.size < maxEntries
  ) {
    const availableSpaces =
      maxEntries - visitedIds.size;

    const currentBatch = queue.splice(
      0,
      Math.min(
        FRANCHISE_BATCH_SIZE,
        availableSpaces
      )
    );

    const idsToFetch = currentBatch
      .map((item) => item.id)
      .filter((id) => {
        return !franchiseAnimeCache.has(id);
      });

    if (idsToFetch.length > 0) {
      await fetchAnimeBatchWithRetry(idsToFetch);
      await wait(FRANCHISE_REQUEST_DELAY);
    }

    for (const item of currentBatch) {
      if (visitedIds.has(item.id)) continue;

      const anime =
        franchiseAnimeCache.get(item.id) ||
        item.preview;

      visitedIds.add(item.id);

      if (!anime) continue;

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

  sortAllFranchiseContent(franchise);
  updateFranchiseStatistics(franchise);

  franchise.badges = generateBadges(franchise);

  franchise.discovery.entriesFound =
    visitedIds.size;

  franchise.discovery.reachedSafetyLimit =
    visitedIds.size >= maxEntries;
    
fullFranchiseCache.set(rootAnime.id, franchise);

  return franchise;
}
