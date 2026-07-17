const ANILIST_API = "https://graphql.anilist.co";
async function getPopularAnime() {
  const query = `
    query {
      Page(page: 1, perPage: 24) {
        media(type: ANIME, sort: POPULARITY_DESC) {
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
        }
      }
    }
  `;
  const response = await fetch(ANILIST_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
    }),
  });
  const data = await response.json();

if (!response.ok || data.errors) {
  console.error("AniList error:", data.errors || data);
  throw new Error("AniList request failed");
}

return data.data.Page.media;
}