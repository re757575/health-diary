import type { Entry, MealType } from './entry'

/** 清單裡一個食物名稱的長度上限；再長多半是貼錯（例如整段文章） */
export const MAX_FOOD_NAME_LENGTH = 30

/**
 * 解析貼上或檔案匯入的食物清單：一行一個，或用逗號、頓號、分號、空格、Tab 分隔都可以。
 * 去掉頭尾空白與 CSV 的引號，空白、重複與過長的略過，保留原本的順序
 */
export function parseFoodList(text: string): string[] {
  const names = text
    .split(/[\s,，、;；]/)
    .map((s) => s.replace(/^["']|["']$/g, '').trim())
    .filter((s) => s !== '' && s.length <= MAX_FOOD_NAME_LENGTH)
  return [...new Set(names)]
}

/** 依輸入的字篩選食物（不分大小寫）；沒輸入時全部回傳 */
export function filterFoods(foods: readonly string[], query: string): string[] {
  const q = query.trim().toLowerCase()
  return q === '' ? [...foods] : foods.filter((f) => f.toLowerCase().includes(q))
}

/**
 * 依過去吃過的次數排序，常吃的在前；給了 mealType 就只算那一餐（早餐常吃的不一定是晚餐常吃的）。
 * 同一餐重複只算一次；次數相同維持清單原本的順序
 */
export function sortFoodsByUsage(
  foods: readonly string[],
  entries: Entry[],
  mealType?: MealType,
): string[] {
  const counts = new Map(foods.map((f) => [f, 0]))
  for (const entry of entries) {
    for (const meal of entry.meals) {
      if (mealType && meal.type !== mealType) continue
      for (const name of new Set(meal.items?.map((i) => i.name))) {
        const count = counts.get(name)
        if (count !== undefined) counts.set(name, count + 1)
      }
    }
  }
  return [...foods].sort((a, b) => counts.get(b)! - counts.get(a)!)
}
