import { getCategoryThumbnail } from '../featured-categories.data'

export function FeaturedCategories({
  categories,
  onSelectCategory,
}: {
  categories?: { id: string; name: string }[]
  onSelectCategory: (categoryId: string) => void
}) {
  if (!categories || categories.length === 0) return null

  const displayCategories = categories.slice(0, 6)

  return (
    <section className="py-8 sm:py-12 bg-background border-b border-border/80">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-foreground">
              Danh mục nổi bật
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Khám phá các dòng đồ uống và bánh ngọt đặc sắc
            </p>
          </div>
          <a
            href="#menu"
            className="text-xs sm:text-sm font-bold text-primary hover:underline flex items-center gap-1"
          >
            <span>Xem tất cả</span>
            <span>&rarr;</span>
          </a>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3.5 sm:gap-4">
          {displayCategories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              aria-label={`Khám phá danh mục ${cat.name}`}
              onClick={() => onSelectCategory(cat.id)}
              className="group rounded-2xl border border-border/80 bg-card p-3 text-center transition-all hover:-translate-y-1 hover:border-primary/50 hover:shadow-md cursor-pointer flex flex-col items-center"
            >
              <div className="aspect-square w-full rounded-xl overflow-hidden bg-surface-muted mb-2.5 relative">
                <img
                  src={getCategoryThumbnail(cat.name)}
                  alt=""
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              </div>

              <span className="font-bold text-xs sm:text-sm text-foreground group-hover:text-primary transition-colors line-clamp-1">
                {cat.name}
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}

