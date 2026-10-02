const build = (game, file, label) => ({ id: file, label, url: `/games/${game}/${file}.html` });

export const FEATURED = [
  {
    id: "all-in-hole",
    name: "All In Hole",
    thumb: "/thumbs/all-in-hole.jpg",
    versions: [
      build("all-in-hole", "b1-v1", "Brief 1 · V1"),
      build("all-in-hole", "b1-v2", "Brief 1 · V2"),
      build("all-in-hole", "b1-v3", "Brief 1 · V3"),
      build("all-in-hole", "city-v1", "City · V1"),
      build("all-in-hole", "city-v2", "City · V2"),
      build("all-in-hole", "city-v3", "City · V3"),
      build("all-in-hole", "city-v4", "City · V4"),
      build("all-in-hole", "caterpillars-v1", "City Caterpillars · V1"),
      build("all-in-hole", "caterpillars-v2", "City Caterpillars · V2"),
      build("all-in-hole", "3d", "3D · Base"),
      build("all-in-hole", "3d-v4", "3D · V4"),
      build("all-in-hole", "3d-v5", "3D · V5"),
      build("all-in-hole", "remake-v1", "Brief 1 Remake · V1"),
      build("all-in-hole", "remake-v2", "Brief 1 Remake · V2"),
      build("all-in-hole", "remake-v5", "Brief 1 Remake · V5"),
    ],
  },
  {
    id: "category-sort",
    name: "Category Sort",
    thumb: "/thumbs/category-sort.jpg",
    versions: [build("category-sort", "60-sec", "60 sec")],
  },
  {
    id: "knock-it",
    name: "Knock It",
    thumb: "/thumbs/knock-it.jpg",
    versions: [
      build("knock-it", "v1", "V1"),
      build("knock-it", "v2", "V2"),
      build("knock-it", "v3", "V3"),
    ],
  },
];
