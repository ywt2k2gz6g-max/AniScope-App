let catalogPage = 1;
let catalogLoading = false;
let catalogHasMore = true;

const catalogAnimeById = new Map();
const catalogParentById = new Map();

const CATALOG_FRANCHISE_RELATION_TYPES = new Set([
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

/* =====================================================
   CATALOG FRANCHISE GROUPING
===================================================== */

function ensureCatalogAnimeSet(animeId) {
  if (!catalogParentById.has(animeId)) {
    catalogParentById.set(animeId, animeId);
  }
}

function findCatalogFranchiseRoot(animeId) {
  ensureCatalogAnimeSet(animeId);

  const parentId = catalogParentById.get(animeId);

  if (parentId === animeId) {
    return animeId;
  }

  const rootId = findCatalogFranchiseRoot(parentId);

  catalogParentById.set(animeId, rootId);

  return rootId;
}

function unionCatalogAnime(firstId, secondId) {
  const firstRoot =
    findCatalogFranchiseRoot(firstId);

  const secondRoot =
    findCatalogFranchiseRoot(secondId);

  if (firstRoot === secondRoot) return;

  if (firstRoot < secondRoot) {
    catalogParentById.set(
      secondRoot,
      firstRoot
    );
  } else {
    catalogParentById.set(
      firstRoot,
      secondRoot
    );
  }
}

function registerCatalogAnime(anime) {
  if (!anime?.id) return;

  catalogAnimeById.set(anime.id, anime);

  ensureCatalogAnimeSet(anime.id);

  const relationships =
    anime.relations?.edges || [];

  relationships.forEach((edge) => {
    const relatedAnime = edge.node;
    const relationType = edge.relationType;

    if (!relatedAnime?.id) return;

    if (relatedAnime.type !== "ANIME") {
      return;
    }

    if (
      !CATALOG_FRANCHISE_RELATION_TYPES.has(
        relationType
      )
    ) {
      return;
    }

    if (
      !catalogAnimeById.has(relatedAnime.id)
    ) {
      catalogAnimeById.set(
        relatedAnime.id,
        relatedAnime
      );
    }

    ensureCatalogAnimeSet(relatedAnime.id);

    unionCatalogAnime(
      anime.id,
      relatedAnime.id
    );
  });
}

function registerCatalogBatch(animeList) {
  animeList.forEach(registerCatalogAnime);
}

function getCatalogFormatPriority(format) {
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

function chooseCatalogRepresentative(entries) {
  return [...entries].sort(
    (firstAnime, secondAnime) => {
      const formatDifference =
        getCatalogFormatPriority(
          firstAnime.format
        ) -
        getCatalogFormatPriority(
          secondAnime.format
        );

      if (formatDifference !== 0) {
        return formatDifference;
      }

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
  )[0];
}

function getCatalogLoadedIndex(entries) {
  if (
    typeof AniScope === "undefined" ||
    !Array.isArray(AniScope.catalog)
  ) {
    return Number.MAX_SAFE_INTEGER;
  }

  let earliestIndex =
    Number.MAX_SAFE_INTEGER;

  entries.forEach((entry) => {
    const index =
      AniScope.catalog.findIndex(
        (anime) => anime.id === entry.id
      );

    if (
      index !== -1 &&
      index < earliestIndex
    ) {
      earliestIndex = index;
    }
  });

  return earliestIndex;
}

function getCatalogFranchises() {
  const groups = new Map();

  catalogAnimeById.forEach((anime) => {
    const rootId =
      findCatalogFranchiseRoot(anime.id);

    if (!groups.has(rootId)) {
      groups.set(rootId, []);
    }

    groups.get(rootId).push(anime);
  });

  return [...groups.values()]
    .map((entries) => {
      return {
        representative:
          chooseCatalogRepresentative(entries),

        entries,
      };
    })
    .sort(
      (firstGroup, secondGroup) => {
        return (
          getCatalogLoadedIndex(
            firstGroup.entries
          ) -
          getCatalogLoadedIndex(
            secondGroup.entries
          )
        );
      }
    );
}

/* =====================================================
   CATALOG LOADING
===================================================== */

async function loadCatalogPage() {
  if (
    catalogLoading ||
    !catalogHasMore
  ) {
    return;
  }

  catalogLoading = true;

  updateCatalogStatus(
    "Loading more anime..."
  );

  try {
    const newAnime =
      await getPopularAnime(catalogPage);

    if (!newAnime.length) {
      catalogHasMore = false;

      updateCatalogStatus(
        "You reached the end."
      );

      return;
    }

    if (
      typeof AniScope !== "undefined"
    ) {
      AniScope.catalog =
        AniScope.catalog || [];

      AniScope.catalog.push(
        ...newAnime
      );
    }

    registerCatalogBatch(newAnime);

    renderCatalogItems();

    catalogPage += 1;

    updateCatalogStatus("");
  } catch (error) {
    console.error(
      "Catalog failed to load:",
      error
    );

    updateCatalogStatus(
      "Could not load more anime."
    );
    } finally {
    catalogLoading = false;

    /*
      Franchise grouping can reduce the number of visible cards.
      If the page still is not tall enough to scroll, automatically
      load another catalog page until the loading marker moves
      below the viewport.
    */
    requestAnimationFrame(() => {
      const status =
        document.getElementById(
          "catalogStatus"
        );

      if (
        !status ||
        !catalogHasMore
      ) {
        return;
      }

      const statusPosition =
        status.getBoundingClientRect();

      const loadingDistance =
        window.innerHeight + 300;

      if (
        statusPosition.top <=
        loadingDistance
      ) {
        loadCatalogPage();
      }
    });
  }
}

function renderCatalogItems() {
  const catalogContainer =
    document.getElementById(
      "catalogResults"
    );

  if (!catalogContainer) return;

  const franchises =
    getCatalogFranchises();

  const cards = franchises
    .map(
      ({
        representative,
        entries,
      }) => {
        const title =
          representative.title
            ?.english ||
          representative.title
            ?.romaji ||
          "Unknown Anime";

        const cover =
          representative.coverImage
            ?.extraLarge ||
          representative.coverImage
            ?.large ||
          "";

        const connectedLabel =
          entries.length > 1
            ? ` · ${entries.length} connected entries`
            : "";

        return `
          <button
            class="catalog-card"
            type="button"
            data-anime-id="${representative.id}"
          >
            <img
              src="${escapeHtml(cover)}"
              alt="${escapeHtml(title)} cover"
              loading="lazy"
            >

            <div class="catalog-card-info">
              <h3>
                ${escapeHtml(title)}
              </h3>

              <p>
                ★ ${
                  representative.averageScore ||
                  "N/A"
                }
                · ${
                  representative.episodes ||
                  "?"
                } episodes
                ${connectedLabel}
              </p>
            </div>
          </button>
        `;
      }
    )
    .join("");

  catalogContainer.innerHTML =
    cards;
}

function updateCatalogStatus(message) {
  const status =
    document.getElementById(
      "catalogStatus"
    );

  if (status) {
    status.textContent = message;
  }
}

/* =====================================================
   INFINITE SCROLL
===================================================== */

function setupInfiniteScroll() {
  const catalogContainer =
    document.getElementById(
      "catalogResults"
    );

  if (!catalogContainer) return;

  let status =
    document.getElementById(
      "catalogStatus"
    );

  if (!status) {
    status =
      document.createElement("div");

    status.id = "catalogStatus";

    status.className =
      "catalog-status";

    catalogContainer
      .insertAdjacentElement(
        "afterend",
        status
      );
  }

  const observer =
    new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting
        ) {
          loadCatalogPage();
        }
      },
      {
        rootMargin: "300px",
      }
    );

  observer.observe(status);

  loadCatalogPage();
}

/* =====================================================
   CATALOG CARD CLICK
===================================================== */

document.addEventListener(
  "click",
  async (event) => {
    const card =
      event.target.closest(
        ".catalog-card"
      );

    if (!card) return;

    const animeId = Number(
      card.dataset.animeId
    );

    if (!animeId) return;

    card.disabled = true;

    try {
      console.log(
        "Building franchise..."
      );

      const anime =
        await getAnimeById(animeId);

      renderFranchiseLoading(
        anime
      );

      const franchise =
        await buildFullFranchise(
          anime
        );

      renderFranchiseHub(
        franchise
      );
    } catch (error) {
      console.error(
        "Could not build franchise:",
        error
      );

      renderFranchiseError();
    } finally {
      card.disabled = false;
    }
  }
);

/* =====================================================
   FRANCHISE LOADING VIEW
===================================================== */

function renderFranchiseLoading(
  anime
) {
  const hub =
    getOrCreateFranchiseHub();

  const title =
    anime.title?.english ||
    anime.title?.romaji ||
    "Loading franchise";

  const cover =
    anime.coverImage?.extraLarge ||
    anime.coverImage?.large ||
    "";

  hub.innerHTML = `
    <div
      class="franchise-hub-backdrop"
      data-close-franchise
    ></div>

    <section
      class="franchise-hub-panel"
    >
      <button
        class="franchise-close"
        type="button"
        data-close-franchise
        aria-label="Close franchise"
      >
        ×
      </button>

      <div
        class="franchise-loading"
      >
        <img
          src="${escapeHtml(cover)}"
          alt="${escapeHtml(title)} cover"
        >

        <h2>
          ${escapeHtml(title)}
        </h2>

        <div
          class="franchise-spinner"
        ></div>

        <p>
          Building franchise...
        </p>

        <small>
          Finding seasons, movies,
          specials, and spin-offs
        </small>
      </div>
    </section>
  `;

  openFranchiseHub(hub);
}

/* =====================================================
   FULL FRANCHISE HUB
===================================================== */

function renderFranchiseHub(
  franchise
) {
  const hub =
    getOrCreateFranchiseHub();

  const stats =
    franchise.statistics;

  const badgesHtml =
    franchise.badges
      .map((badge) => {
        return `
          <span
            class="franchise-badge"
          >
            ${escapeHtml(badge)}
          </span>
        `;
      })
      .join("");

  const backgroundImage =
    franchise.artwork.banner ||
    franchise.artwork.cover ||
    "";

  hub.innerHTML = `
    <div
      class="franchise-hub-backdrop"
      data-close-franchise
    ></div>

    <section
      class="franchise-hub-panel"
    >
      <button
        class="franchise-close"
        type="button"
        data-close-franchise
        aria-label="Close franchise"
      >
        ×
      </button>

      <div
        class="franchise-banner"
        style="
          background-image:
            linear-gradient(
              to bottom,
              rgba(
                10,
                14,
                30,
                0.15
              ),
              rgba(
                10,
                14,
                30,
                1
              )
            ),
            url('${escapeHtml(
              backgroundImage
            )}');
        "
      >
        <img
          class="franchise-cover"
          src="${escapeHtml(
            franchise.artwork.cover
          )}"
          alt="${escapeHtml(
            franchise.title
          )} cover"
        >
      </div>

      <div
        class="franchise-hub-content"
      >
        <h1>
          ${escapeHtml(
            franchise.title
          )}
        </h1>

        <div
          class="franchise-badges"
        >
          ${badgesHtml}
        </div>

        <div
          class="franchise-stat-grid"
        >
          <div>
            <strong>
              ${stats.totalEpisodes}
            </strong>

            <span>
              Episodes
            </span>
          </div>

          <div>
            <strong>
              ${stats.mainEntries}
            </strong>

            <span>
              Main entries
            </span>
          </div>

          <div>
            <strong>
              ${stats.movies}
            </strong>

            <span>
              Movies
            </span>
          </div>

          <div>
            <strong>
              ${stats.specials}
            </strong>

            <span>
              Specials
            </span>
          </div>
        </div>

        ${renderFranchiseSection(
          "Main Story",
          franchise.content
            .mainStory
        )}

        ${renderFranchiseSection(
          "Movies",
          franchise.content.movies
        )}

        ${renderFranchiseSection(
          "Specials & OVAs",
          franchise.content.specials
        )}

        ${renderFranchiseSection(
          "Spin-offs",
          franchise.content.spinOffs
        )}

        ${renderFranchiseSection(
          "Other",
          franchise.content.other
        )}
      </div>
    </section>
  `;

  openFranchiseHub(hub);
}

function renderFranchiseSection(
  title,
  entries
) {
  if (!entries?.length) {
    return "";
  }

  const entriesHtml = entries
    .map((entry) => {
      const entryTitle =
        entry.title?.english ||
        entry.title?.romaji ||
        "Unknown Anime";

      const cover =
        entry.coverImage
          ?.extraLarge ||
        entry.coverImage?.large ||
        "";

      const year =
        entry.seasonYear ||
        "Year unknown";

      const episodeText =
        entry.episodes
          ? `${entry.episodes} episodes`
          : "Episode count unknown";

      return `
        <article
          class="franchise-entry"
          data-anime-id="${entry.id}"
        >
          <img
            src="${escapeHtml(cover)}"
            alt="${escapeHtml(
              entryTitle
            )} cover"
            loading="lazy"
          >

          <div>
            <h3>
              ${escapeHtml(
                entryTitle
              )}
            </h3>

            <p>
              ${escapeHtml(year)}
              ·
              ${escapeHtml(
                episodeText
              )}
            </p>
          </div>
        </article>
      `;
    })
    .join("");

  return `
    <section
      class="franchise-section"
    >
      <h2>
        ${escapeHtml(title)}
      </h2>

      <div
        class="franchise-entry-list"
      >
        ${entriesHtml}
      </div>
    </section>
  `;
}

/* =====================================================
   ERROR VIEW
===================================================== */

function renderFranchiseError() {
  const hub =
    getOrCreateFranchiseHub();

  hub.innerHTML = `
    <div
      class="franchise-hub-backdrop"
      data-close-franchise
    ></div>

    <section
      class="franchise-hub-panel"
    >
      <button
        class="franchise-close"
        type="button"
        data-close-franchise
        aria-label="Close franchise"
      >
        ×
      </button>

      <div
        class="franchise-loading"
      >
        <h2>
          Could not load franchise
        </h2>

        <p>
          AniList may be
          temporarily busy.
        </p>

        <small>
          Close this panel and
          try again shortly.
        </small>
      </div>
    </section>
  `;

  openFranchiseHub(hub);
}

/* =====================================================
   FRANCHISE HUB HELPERS
===================================================== */

function getOrCreateFranchiseHub() {
  let hub =
    document.getElementById(
      "franchiseHub"
    );

  if (!hub) {
    hub =
      document.createElement("div");

    hub.id = "franchiseHub";

    hub.className =
      "franchise-hub";

    document.body.appendChild(
      hub
    );
  }

  return hub;
}

function openFranchiseHub(hub) {
  hub.classList.add("open");

  document.body.classList.add(
    "franchise-open"
  );
}

function closeFranchiseHub() {
  const hub =
    document.getElementById(
      "franchiseHub"
    );

  if (!hub) return;

  hub.classList.remove("open");

  document.body.classList.remove(
    "franchise-open"
  );
}

document.addEventListener(
  "click",
  (event) => {
    if (
      event.target.closest(
        "[data-close-franchise]"
      )
    ) {
      closeFranchiseHub();
    }
  }
);

document.addEventListener(
  "keydown",
  (event) => {
    if (event.key === "Escape") {
      closeFranchiseHub();
    }
  }
);

/* =====================================================
   BASIC HTML SAFETY
===================================================== */

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll(
      '"',
      "&quot;"
    )
    .replaceAll(
      "'",
      "&#039;"
    );
}

/* =====================================================
   START
===================================================== */

setupInfiniteScroll();