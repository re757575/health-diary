import type { Entry, MealType } from './entry'

/** 清單裡一個食物名稱的長度上限；再長多半是貼錯（例如整段文章） */
export const MAX_FOOD_NAME_LENGTH = 30

/**
 * 判斷兩個食物名稱是否算同一個用的比對鍵：全形與半形（（小）／(小)、ＤＨＣ／DHC）、
 * 大小寫與空白的差異都不算不同。只用來比對，存下來的仍是原本的寫法
 */
export function foodKey(name: string): string {
  return name.normalize('NFKC').toLowerCase().replace(/\s+/g, '')
}

/** 去掉重複（依 foodKey 比對），保留先出現的寫法與順序；`existing` 裡已有的也略過 */
export function uniqueFoods(names: readonly string[], existing: readonly string[] = []): string[] {
  const seen = new Set(existing.map(foodKey))
  return names.filter((name) => {
    const key = foodKey(name)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/**
 * 解析貼上或檔案匯入的食物清單：一行一個，或用逗號、頓號、分號、空格、Tab 分隔都可以。
 * 去掉頭尾空白與 CSV 的引號，空白、重複（含全形半形、大小寫不同）與過長的略過，保留原本的順序
 */
export function parseFoodList(text: string): string[] {
  return uniqueFoods(splitFoodList(text))
}

/** 拆出清單裡的每個名稱（還沒去掉重複），用來算略過了幾項 */
export function splitFoodList(text: string): string[] {
  return text
    .split(/[\s,，、;；]/)
    .map((s) => s.replace(/^["']|["']$/g, '').trim())
    .filter((s) => s !== '' && s.length <= MAX_FOOD_NAME_LENGTH)
}

/**
 * 存檔時要自動加進常吃清單的食物名稱：不重複，名稱有空格的略過。
 * 清單匯入時空格是分隔符號，有空格的名稱匯出再匯入會被拆開，所以不放進清單（餐點裡照樣保留）
 */
export function foodsToRemember(names: readonly string[]): string[] {
  return uniqueFoods(
    names
      .map((n) => n.trim())
      .filter((n) => n !== '' && !/\s/.test(n) && n.length <= MAX_FOOD_NAME_LENGTH),
  )
}

/** 匯出成文字檔的內容：一行一個，可以直接用 parseFoodList 匯回來 */
export function formatFoodList(foods: readonly string[]): string {
  return foods.length > 0 ? `${foods.join('\n')}\n` : ''
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
