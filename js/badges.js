function generateBadges(franchise) {
  const badges = [];
  const stats = franchise.statistics;

  const mainStory = franchise.content.mainStory;

  const hasReleasingEntry = mainStory.some(
    (entry) => entry.status === "RELEASING"
  );

  const allMainEntriesFinished =
    mainStory.length > 0 &&
    mainStory.every(
      (entry) => entry.status === "FINISHED"
    );

  if (stats.totalEpisodes >= 100) {
    badges.push("📺 Long Series");
  }

  if (
    stats.totalEpisodes > 0 &&
    stats.totalEpisodes <= 30 &&
    allMainEntriesFinished
  ) {
    badges.push("✅ Easy Weekend Binge");
  }

  if (stats.movies > 0) {
    badges.push("🎬 Movies");
  }

  if (stats.specials >= 3) {
    badges.push("✨ Extra Content");
  }

  if (stats.spinOffs > 0) {
    badges.push("🌐 Spin-offs");
  }

  if (hasReleasingEntry) {
    badges.push("🔥 Airing Now");
  }

  if (allMainEntriesFinished) {
    badges.push("🏁 Complete");
  }

  return badges;
}