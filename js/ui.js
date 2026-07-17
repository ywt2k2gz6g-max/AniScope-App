async function loadCatalog() {
  try {
    AniScope.isLoading = true;

    AniScope.catalog = await getPopularAnime();

    renderCatalog();
  } catch (error) {
    console.error("Catalog failed to load:", error);
  } finally {
    AniScope.isLoading = false;
  }
}

function renderCatalog() {
  const catalogContainer = document.getElementById("catalogResults");

  if (!catalogContainer) return;

  catalogContainer.innerHTML = AniScope.catalog
    .map((anime) => {
      const title = anime.title.english || anime.title.romaji;
      const cover =
        anime.coverImage.extraLarge || anime.coverImage.large;

      return `
        <button class="catalog-card" data-anime-id="${anime.id}">
          <img src="${cover}" alt="${title} cover">

          <div class="catalog-card-info">
            <h3>${title}</h3>
            <p>
              ★ ${anime.averageScore || "N/A"}
              · ${anime.episodes || "?"} episodes
            </p>
          </div>
        </button>
      `;
    })
    .join("");
}

loadCatalog();