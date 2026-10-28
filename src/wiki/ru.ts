// Russian wording for the wiki cards: spell headers, weapon properties and masteries,
// tool uses. The database keeps these in English (SRD wording); the texts here are ours.
import { byId, nameOf, ruName } from '../data'
import type { SpellData } from '../data'
import { dice } from '../rules/text'

export { dice }

const damageName = (id: string) => ruName('damage_types', id).toLowerCase()

// 1 минута, 2 минуты, 5 минут
export function plural(n: number, forms: [string, string, string]): string {
  const a = Math.abs(n) % 100
  const b = a % 10
  if (a > 10 && a < 20) return forms[2]
  if (b === 1) return forms[0]
  if (b >= 2 && b <= 4) return forms[1]
  return forms[2]
}

const UNITS: Record<string, [string, string, string]> = {
  round: ['раунд', 'раунда', 'раундов'],
  minute: ['минута', 'минуты', 'минут'],
  hour: ['час', 'часа', 'часов'],
  day: ['день', 'дня', 'дней'],
  mile: ['миля', 'мили', 'миль'],
  pound: ['фунт', 'фунта', 'фунтов']
}

export const count = (n: number, unit: keyof typeof UNITS) => `${n} ${plural(n, UNITS[unit])}`

// "10 minutes", "1 Hour", "8 hours" -> "10 минут", "1 час", "8 часов"
function time(text: string): string | null {
  const m = text.trim().match(/^(\d+)\s+(round|minute|hour|day)s?$/i)
  return m ? count(Number(m[1]), m[2].toLowerCase() as keyof typeof UNITS) : null
}

const missile = () => '«' + nameOf(byId.spell['magic-missile']) + '»'

// casting times with a trigger, in our words
const CASTING: Record<string, () => string> = {
  Action: () => 'Действие',
  'Bonus Action': () => 'Бонусное действие',
  Reaction: () => 'Реакция',
  'Bonus Action, right after your melee weapon attack or Unarmed Strike hits a creature': () =>
    'Бонусное действие сразу после попадания по существу рукопашным оружием или безоружным ударом',
  'Bonus Action, right after your melee weapon attack or Unarmed Strike hits a target': () =>
    'Бонусное действие сразу после попадания по цели рукопашным оружием или безоружным ударом',
  'Bonus Action, which you take immediately after hitting a target with a Melee weapon or an Unarmed Strike': () =>
    'Бонусное действие сразу после попадания по цели рукопашным оружием или безоружным ударом',
  'Bonus Action, which you take immediately after hitting a creature with a Melee weapon or an Unarmed Strike': () =>
    'Бонусное действие сразу после попадания по существу рукопашным оружием или безоружным ударом',
  'Bonus Action, which you take immediately after hitting a creature with a weapon': () =>
    'Бонусное действие сразу после попадания по существу оружием',
  'Bonus Action, right after your ranged weapon attack hits a creature': () =>
    'Бонусное действие сразу после попадания по существу дальнобойным оружием',
  'Bonus Action, right after you make a ranged weapon attack, whether it hits or misses': () =>
    'Бонусное действие сразу после атаки дальнобойным оружием, попала она или нет',
  'Reaction, which you take when you or a creature you can see within 60 feet of you falls': () =>
    'Реакция, когда вы или видимое вами существо в пределах 60 фт падает',
  'Reaction, which you take in response to taking damage from a creature that you can see within 60 feet of yourself': () =>
    'Реакция, когда вы получаете урон от видимого вами существа в пределах 60 фт',
  'Reaction, which you take when you are hit by an attack roll or targeted by the Magic Missile spell': () =>
    `Реакция, когда по вам попадает бросок атаки или вас выбирают целью заклинания ${missile()}`,
  'Reaction, which you take when you see a creature within 60 feet of yourself casting a spell with Verbal, Somatic, or Material components': () =>
    'Реакция, когда вы видите, как существо в пределах 60 фт накладывает заклинание с вербальным, соматическим или материальным компонентом',
  'Action (Overgrowth) or 8 hours (Enrichment)': () => 'Действие (разрастание) или 8 часов (обогащение)'
}

export function castingTime(text: string): string {
  return CASTING[text]?.() ?? time(text) ?? text
}

export function range(text: string): string {
  const t = text.trim()
  const fixed: Record<string, string> = {
    Self: 'На себя', Touch: 'Касание', Sight: 'В пределах видимости', Unlimited: 'Без ограничений', Special: 'Особая'
  }
  if (fixed[t]) return fixed[t]
  const feet = t.match(/^(\d+)\s+f(?:ee|oo)t$/i)
  if (feet) return `${feet[1]} фт`
  const miles = t.match(/^(\d+)\s+miles?$/i)
  if (miles) return count(Number(miles[1]), 'mile')
  return t
}

export function duration(text: string): string {
  const t = text.trim()
  const fixed: Record<string, string> = {
    Instantaneous: 'Мгновенная', 'Until dispelled': 'Пока не рассеется',
    'Until dispelled or triggered': 'Пока не рассеется или не сработает', Special: 'Особая'
  }
  if (fixed[t]) return fixed[t]
  // after «до» the genitive: до 1 минуты, до 10 минут, до 2 часов
  const upTo = t.match(/^(?:concentration,?\s*)?up to (\d+)\s+(round|minute|hour|day)s?$/i)
  if (upTo) {
    const n = Number(upTo[1])
    const gen: Record<string, [string, string]> = {
      round: ['раунда', 'раундов'], minute: ['минуты', 'минут'], hour: ['часа', 'часов'], day: ['дня', 'дней']
    }
    const [one, many] = gen[upTo[2].toLowerCase()]
    return `до ${n} ${n % 10 === 1 && n % 100 !== 11 ? one : many}`
  }
  return time(t) ?? t
}

// the first area of effect named in an SRD spell text: "20-foot-radius Sphere" -> "сфера радиусом 20 фт"
export function areaOf(description: string | null | undefined): string | null {
  if (!description) return null
  const d = description
  let m = d.match(/(\d+)-foot-radius,\s*(\d+)-foot-(?:high|tall)\s+Cylinder/)
  if (m) return `цилиндр радиусом ${m[1]} фт и высотой ${m[2]} фт`
  m = d.match(/(\d+)-foot-radius\s+(Sphere|Cylinder)/)
  if (m) return `${m[2] === 'Sphere' ? 'сфера' : 'цилиндр'} радиусом ${m[1]} фт`
  m = d.match(/(\d+)-foot-long,\s*(\d+)-foot-wide\s+Line/)
  if (m) return `линия длиной ${m[1]} фт и шириной ${m[2]} фт`
  m = d.match(/(\d+)-foot(?:-long)?\s+(Cube|Cone|Emanation|Line)/)
  if (m) return `${{ Cube: 'куб', Cone: 'конус', Emanation: 'эманация', Line: 'линия' }[m[2]]} ${m[1]} фт`
  m = d.match(/(\d+)-foot radius/)
  if (m) return `радиус ${m[1]} фт`
  return null
}

// weapon properties and masteries (2024 rules), short and in our words
export const PROPERTY_RU: Record<string, string> = {
  ammunition: 'Для атаки нужен боеприпас, каждая атака тратит один; после боя за минуту можно собрать половину.',
  finesse: 'Для атаки и урона можно использовать Силу или Ловкость — одно и то же для обоих бросков.',
  heavy: 'Помеха на броски атаки, если Сила (рукопашное) или Ловкость (дальнобойное) ниже 13.',
  light: 'После атаки им в действии Атака можно бонусным действием атаковать другим лёгким оружием; к урону этой атаки модификатор не добавляется, если он не отрицательный.',
  loading: 'За действие, бонусное действие или реакцию — только один выстрел, сколько бы атак у вас ни было.',
  range: 'Нормальная и максимальная дистанция: дальше нормальной атака с помехой, дальше максимальной нельзя.',
  reach: 'Досягаемость атаки этим оружием на 5 фт больше.',
  thrown: 'Можно метнуть для дальнобойной атаки, достав оружие в рамках атаки; модификатор тот же, что у рукопашной атаки им.',
  'two-handed': 'Для атаки нужны обе руки.',
  versatile: 'Можно держать одной или двумя руками; двумя руками урон выше.'
}

export const MASTERY_RU: Record<string, string> = {
  cleave: 'Попав рукопашной атакой, можно раз в ход атаковать второе существо в 5 фт от первого и в пределах досягаемости; к урону не добавляется модификатор, если он не отрицательный.',
  graze: 'При промахе цель всё равно получает урон того же вида, равный модификатору характеристики атаки.',
  nick: 'Дополнительную атаку от свойства «Лёгкое» можно сделать в действии Атака, а не бонусным действием; раз в ход.',
  push: 'При попадании можно оттолкнуть существо не больше Большого на 10 фт от себя.',
  sap: 'При попадании цель совершает следующий бросок атаки до начала вашего следующего хода с помехой.',
  slow: 'При попадании с уроном скорость цели уменьшается на 10 фт до начала вашего следующего хода; не суммируется.',
  topple: 'При попадании цель совершает спасбросок Телосложения (Сл 8 + модификатор атаки + бонус мастерства), иначе падает ничком.',
  vex: 'При попадании с уроном ваш следующий бросок атаки по этому существу до конца следующего хода — с преимуществом.'
}

// what a tool does with the Utilize action (the SRD lines, retold)
const UTILIZE: Record<string, string> = {
  'Identify a substance (DC 15), or start a fire (DC 15)': 'Опознать вещество (Сл 15) или развести огонь (Сл 15)',
  'Detect poisoned drink (DC 15), or identify alcohol (DC 10)': 'Распознать отравленный напиток (Сл 15) или определить алкоголь (Сл 10)',
  'Write text with impressive flourishes that guard against forgery (DC 15)': 'Написать текст с росчерками, защищающими от подделки (Сл 15)',
  'Seal or pry open a door or container (DC 20)': 'Запечатать или вскрыть дверь либо контейнер (Сл 20)',
  'Draft a map of a small area (DC 15)': 'Начертить карту небольшой местности (Сл 15)',
  "Modify footwear to give Advantage on the wearer's next Dexterity (Acrobatics) check (DC 10)":
    'Подправить обувь: владелец совершит следующую проверку Ловкости (Акробатика) с преимуществом (Сл 10)',
  "Improve food's flavor (DC 10), or detect spoiled or poisoned food (DC 15)": 'Улучшить вкус еды (Сл 10) или распознать испорченную либо отравленную еду (Сл 15)',
  'Discern what a glass object held in the past 24 hours (DC 15)': 'Определить, что было в стеклянном сосуде за последние 24 часа (Сл 15)',
  "Discern a gem's value (DC 15)": 'Оценить драгоценный камень (Сл 15)',
  'Add a design to a leather item (DC 10)': 'Нанести узор на кожаное изделие (Сл 10)',
  'Chisel a symbol or hole in stone (DC 10)': 'Высечь знак или отверстие в камне (Сл 10)',
  "Paint a recognizable image of something you've seen (DC 10)": 'Нарисовать узнаваемое изображение того, что видели (Сл 10)',
  'Discern what a ceramic object held in the past 24 hours (DC 15)': 'Определить, что было в керамическом сосуде за последние 24 часа (Сл 15)',
  'Pry open a door or container (DC 20)': 'Вскрыть дверь или контейнер (Сл 20)',
  'Assemble a Tiny item composed of scrap, which falls apart in 1 minute (DC 20)': 'Собрать из обрезков крошечный предмет, который развалится через 1 минуту (Сл 20)',
  'Mend a tear in clothing (DC 10), or sew a Tiny design (DC 10)': 'Зашить прореху в одежде (Сл 10) или вышить крошечный узор (Сл 10)',
  'Carve a pattern in wood (DC 10)': 'Вырезать узор на дереве (Сл 10)',
  'Apply makeup (DC 10)': 'Нанести грим (Сл 10)',
  "Mimic 10 or fewer words of someone else's handwriting (DC 15), or duplicate a wax seal (DC 20)":
    'Подделать чужой почерк, до 10 слов (Сл 15), или скопировать восковую печать (Сл 20)',
  'Discern whether someone is cheating (DC 10), or win the game (DC 20)': 'Заметить жульничество (Сл 10) или выиграть партию (Сл 20)',
  'Identify a plant (DC 10)': 'Опознать растение (Сл 10)',
  'Play a known tune (DC 10), or improvise a song (DC 15)': 'Сыграть знакомую мелодию (Сл 10) или сымпровизировать песню (Сл 15)',
  'Plot a course (DC 10), or determine position by stargazing (DC 15)': 'Проложить курс (Сл 10) или определить положение по звёздам (Сл 15)',
  'Detect a poisoned object (DC 10)': 'Распознать отравленный предмет (Сл 10)',
  'Pick a lock (DC 15), or disarm a trap (DC 15)': 'Вскрыть замок (Сл 15) или обезвредить ловушку (Сл 15)'
}

export const utilize = (text: string) => UTILIZE[text] ?? text

export const TOOL_TYPE_RU: Record<string, string> = {
  artisan: 'Инструменты ремесленника', 'gaming-set': 'Игровой набор', 'musical-instrument': 'Музыкальный инструмент', other: 'Инструменты'
}

export const ARMOR_TYPE_RU: Record<string, string> = {
  light: 'Лёгкий доспех', medium: 'Средний доспех', heavy: 'Тяжёлый доспех', shield: 'Щит'
}

export function donTime(text: string | undefined): string {
  if (!text) return '—'
  if (/^utilize action$/i.test(text)) return 'действие Использование'
  return time(text) ?? text
}

export const ITEM_CATEGORY_RU: Record<string, string> = {
  gear: 'Снаряжение', pack: 'Набор снаряжения', ammunition: 'Боеприпасы', focus: 'Фокусировка', mount: 'Ездовое животное',
  vehicle: 'Транспорт', tack: 'Упряжь и сбруя', weapon: 'Оружие', armor: 'Доспех', tool: 'Инструменты'
}

export const FOCUS_RU: Record<string, string> = {
  arcane: 'Магическая фокусировка', druidic: 'Друидическая фокусировка', 'holy-symbol': 'Священный символ'
}

// "8к6 огонь; +1к6 за каждый круг выше 3-го" or the list of dice by slot / character level
export function spellDamage(s: SpellData): string {
  const dmg = s.damage
  if (!dmg) return '—'
  const kind = damageName(dmg.type)
  if (s.level === 0) {
    const base = dmg.at_slot_level?.['0'] || Object.values(dmg.at_character_level || {})[0] || ''
    const up = (s.description || '').match(/levels? 5 \((\d+d\d+)\), 11 \((\d+d\d+)\),? and 17 \((\d+d\d+)\)/)
    return `${dice(base)} ${kind}` + (up ? `; на 5, 11 и 17 уровнях: ${up.slice(1).map(dice).join(', ')}` : '')
  }
  const slots = Object.entries(dmg.at_slot_level || {}).map(([l, d]) => [Number(l), d] as const).sort((a, b) => a[0] - b[0])
  if (!slots.length) return '—'
  const [first, base] = slots[0]
  const parsed = slots.map(([, d]) => d.match(/^(\d+)d(\d+)$/))
  const steps = parsed.every((m) => m && m[2] === parsed[0]![2])
    ? parsed.slice(1).map((m, i) => Number(m![1]) - Number(parsed[i]![1]))
    : []
  if (slots.length > 1 && steps.length && steps.every((x) => x === steps[0] && x > 0)) {
    return `${dice(base)} ${kind}; +${steps[0]}к${parsed[0]![2]} за каждый круг выше ${first}-го`
  }
  // the SRD text: "The damage increases by 1d6 for each spell slot level above 3."
  const up = `${s.description || ''} ${s.higher_level || ''}`.match(/damage increases by (\d+d\d+) for each spell slot level above (\d+)/)
  if (slots.length === 1 && up) return `${dice(base)} ${kind}; +${dice(up[1])} за каждый круг выше ${up[2]}-го`
  return `${dice(base)} ${kind}` + (slots.length > 1 ? ' (' + slots.slice(1).map(([l, d]) => `${l} круг: ${dice(d)}`).join(', ') + ')' : '')
}

