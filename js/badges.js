function generateBadges(franchise) {
  const badges = [];

  const stats = franchise.statistics;
  const mainStory = franchise.content.mainStory;

  const hasReleasingEntry = mainStory.some(
    (entry) => entry.status === "RELEASING"
  );

  const allFinished =
    mainStory.length > 0 &&
    mainStory.every(
      (entry) => entry.status === "FINISHED"
    );

  const averageScore =
    franchise.averageScore || 0;

  /* ==========================
     Completion
  ========================== */

  if (allFinished) {
    badges.push("🏁 Complete Story");
  }

  if (hasReleasingEntry) {
    badges.push("🔥 Airing Now");
  }

  /* ==========================
     Episode Length
  ========================== */

  if (stats.totalEpisodes >= 500) {
    badges.push("👑 Anime Marathon");
  } else if (stats.totalEpisodes >= 200) {
    badges.push("💎 Epic Saga");
  } else if (stats.totalEpisodes >= 100) {
    badges.push("📺 Long Series");
  } else if (
    stats.totalEpisodes > 0 &&
    stats.totalEpisodes <= 30 &&
    allFinished
  ) {
    badges.push("⚡ Weekend Binge");
  }

  /* ==========================
     Movies
  ========================== */

  if (stats.movies >= 3) {
    badges.push("🍿 Movie Collection");
  } else if (stats.movies > 0) {
    badges.push("🎬 Movie");
  }

  /* ==========================
     Specials
  ========================== */

  if (stats.specials >= 5) {
    badges.push("🎁 Tons of Extras");
  } else if (stats.specials >= 2) {
    badges.push("✨ Extra Content");
  }

  /* ==========================
     Spin-offs
  ========================== */

  if (stats.spinOffs >= 3) {
    badges.push("🕸 Expanded Universe");
  } else if (stats.spinOffs > 0) {
    badges.push("🌐 Spin-Off");
  }

  /* ==========================
     Franchise Size
  ========================== */

  if (stats.totalEntries >= 15) {
    badges.push("🧩 Massive Franchise");
  } else if (stats.totalEntries >= 8) {
    badges.push("📚 Expanded Franchise");
  }

  /* ==========================
     Main Story Size
  ========================== */

  if (stats.mainEntries >= 5) {
    badges.push("📖 Multi-Arc Story");
  }

  /* ==========================
     Ratings
  ========================== */

  if (averageScore >= 90) {
    badges.push("🏆 Masterpiece");
  } else if (averageScore >= 85) {
    badges.push("⭐ Fan Favorite");
  } else if (averageScore >= 80) {
    badges.push("👍 Highly Rated");
  }

  return badges;
}