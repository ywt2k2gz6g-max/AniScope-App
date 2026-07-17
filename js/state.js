window.AniScope = {
  /* Existing properties required by the app */
  catalog: [],
  selectedAnime: null,
  isLoading: false,

  /* Catalog pagination */
  currentPage: 1,
  hasMoreCatalog: true,
  isLoadingCatalog: false,

  /* Search and filters */
  searchQuery: "",
  selectedGenre: null,
  selectedSeason: null,
  selectedYear: null,
  selectedFormat: null,
  selectedSort: "POPULARITY_DESC",

  /* UI state */
  activeModal: null,
  scrollPosition: 0,
};