// Why every field of a new sheet has its value: the reasons for the creation event of the log.
import type { DnDCharacter } from 'dnd-sheet'
import { ABILITIES, abilityName, byId, nameOf, skills } from '../data'
import type { ArmorClassResult, Derived, InventoryLine, KnownSpell } from '../rules/derive'
import { PROFICIENCY_BONUS as PB, bgEquipOption, classEquipOption, optionLines, signed } from '../rules/derive'
import type { WizardState } from '../wizard/state'
import { price } from '../wizard/steps/common'
import { Why } from './changelog'

const q = (s: string) => `«${s}»`

export function creationWhy(
  s: WizardState,
  d: Derived,
  c: DnDCharacter,
  x: { ac: ArmorClassResult; known: KnownSpell[]; inv: InventoryLine[]; itemText: (l: InventoryLine) => string; skillField: Record<string, string> }
): Why {
  const why = new Why()
  const cls = d.cls ? q(nameOf(d.cls)) : ''
  const bg = d.bg ? q(nameOf(d.bg)) : ''
  const sp = d.sp ? q(nameOf(d.sp)) : ''

  for (const k of ['name', 'playerName', 'alignment', 'age', 'height', 'weight', 'eyes', 'skin', 'hair', 'personalityTraits', 'ideals', 'bonds', 'flaws', 'backstory']) {
    why.field(k, 'Введено на шаге «Личность»')
  }
  why.field('classLevel', `Выбран класс ${cls}; новый персонаж начинает с 1-го уровня`)
  why.field('background', 'Выбрана на шаге «Предыстория»')
  why.field('species', d.spOption ? `Выбран вид ${sp} и его вариант ${q(nameOf(d.spOption))}` : `Выбран вид ${sp}`)
  why.field('size', d.sizeOptions.length === 1 ? `У вида ${sp} только этот размер` : `Выбран на шаге «Вид»: вид ${sp} бывает разного размера`)
  why.field('xp', 'Новый персонаж начинает с нулём опыта')

  for (const a of ABILITIES) {
    const rolled = d.base[a]
    const bonus = d.bonus[a]
    why.field(a, (rolled != null ? `Бросок 4к6 (три лучших кости): ${rolled}` : 'Не назначено, по умолчанию 10') +
      (bonus ? `; +${bonus} от предыстории ${bg}` : '') + (rolled != null && rolled + bonus > 20 ? '; выше 20 не бывает' : ''))
  }
  why.field('proficiencyBonus', 'На 1-м уровне бонус мастерства всегда +2')

  for (const a of ABILITIES) {
    const prof = !!d.cls?.saving_throws.includes(a)
    why.field(a + 'Save', `Модификатор: ${abilityName(a)} ${signed(d.mods[a])}` + (prof ? `; +${PB} бонус мастерства, потому что класс ${cls} владеет этим спасброском` : ''))
    why.field(a + 'SaveChecked', `Класс ${cls} даёт владение спасброском`)
  }
  const sourceText = (src: string) =>
    src === 'предыстория' ? `предыстория ${bg}` : src === 'вид' ? `вид ${sp}` : src === 'класс' ? `навыки, выбранные для класса ${cls}` : src
  for (const sk of skills) {
    const field = x.skillField[sk.id]
    const src = d.skills.get(sk.id)
    const exp = d.expertise.has(sk.id)
    const order = d.order?.grants?.skill_check_bonus
    why.field(field, `Модификатор: ${abilityName(sk.ability)} ${signed(d.mods[sk.ability])}` +
      (src ? `; +${PB} за владение (${sourceText(src)})` : '') + (exp ? `; ещё +${PB} за экспертность` : '') +
      (order?.skills.includes(sk.id) ? `; бонус Мудрости от ордена ${q(nameOf(d.order))}` : ''))
    if (src) why.field(field + 'Checked', `Владение даёт ${sourceText(src)}`)
  }
  why.field('passivePerception', `10 + навык Восприятие (${c.skillPerception})`)

  const orderArmor = new Set(d.order?.grants?.armor_training || [])
  const armorKeys: Record<string, string> = { light: 'armorLight', medium: 'armorMedium', heavy: 'armorHeavy', shield: 'armorShields' }
  for (const [a, key] of Object.entries(armorKeys)) {
    why.field(key, orderArmor.has(a) ? `Даёт орден ${q(nameOf(d.order))}` : `Класс ${cls} обучен этим доспехам`)
  }
  why.field('weaponProficiencies', `Владение оружием класса ${cls}` + (d.order?.grants?.weapon_proficiencies ? ` и ордена ${q(nameOf(d.order))}` : ''))
  for (const [id, src] of d.tools) why.part('toolProficiencies', nameOf(byId.item[id]), `Владение даёт ${sourceText(src)}`)
  for (const [id, src] of d.languages) {
    why.part('languages', nameOf(byId.language[id]), src === 'все персонажи' ? 'Общий язык знают все персонажи'
      : src === 'на выбор' ? 'Каждый персонаж выбирает два языка при создании' : `Даёт класс ${cls}`)
  }

  why.field('ac', `Лучший вариант из того, что есть: ${x.ac.formula}`)
  why.field('init', `Модификатор Ловкости ${signed(d.mods.dex)}` + (d.featSlots.some((f) => f.feat.id === 'alert') ? `; +${PB} от черты «Бдительный»` : ''))
  why.field('speed', `Скорость вида ${sp}` + (x.ac.speedPenalty ? `; −${x.ac.speedPenalty} фт: Силы не хватает для доспеха ${q(nameOf(x.ac.armor))}` : ''))
  if (d.cls) {
    const extra = [d.sp?.id === 'dwarf' ? '+1 от Дварфийской выдержки' : '', d.featSlots.some((f) => f.feat.id === 'tough') ? '+2 от черты «Крепкий»' : ''].filter(Boolean)
    why.field('maxHp', `Кость хитов класса ${cls} — к${d.cls.hit_die}: на 1-м уровне берётся максимум, ${d.cls.hit_die}; ` +
      `плюс модификатор Телосложения ${signed(d.mods.con)}` + (extra.length ? '; ' + extra.join('; ') : ''))
    why.field('hp', 'Персонаж начинает с полными хитами')
    why.field('hitDiceMax', `На 1-м уровне одна кость хитов класса ${cls}`)
    why.field('hitDice', 'Все кости хитов пока не потрачены')
  }

  // attacks: the weapons in the hero's hands and damage cantrips
  for (const r of c.attacks || []) {
    const w = Object.values(byId.weapon).find((v) => r.name && String(r.name).startsWith(nameOf(v)))
    const k = x.known.find((v) => nameOf(v.spell) === r.name)
    const reason = w
      ? `Оружие в руках героя (стартовое снаряжение); атака: ${w.properties.includes('finesse') ? 'Сила или Ловкость (фехтовальное)' : w.type === 'ranged' ? 'Ловкость' : 'Сила'}` +
        (d.weaponIds.has(w.id) ? ` + бонус мастерства (класс ${cls} владеет этим оружием)` : ', без бонуса мастерства: нет владения')
      : k
        ? `Заговор с уроном; ${k.spell.attack_type ? 'бонус атаки заклинаниями' : 'Сл спасброска от заклинаний'}`
        : ''
    if (reason) why.part('attacks', String(r.name), reason)
  }
  why.field('attacksText', 'Не поместилось в таблицу из пяти строк')

  const money = startingMoney(d, s)
  for (const k of ['gp', 'sp', 'cp']) why.field(k, money)

  const fromClass = new Set(optionLines('class', classEquipOption(d, s), s).map((l) => l.item.id))
  const fromBg = new Set(optionLines('bg', bgEquipOption(d, s), s).map((l) => l.item.id))
  for (const l of x.inv) {
    const src = [
      fromClass.has(l.item.id) ? `стартовое снаряжение класса ${cls} (вариант ${s.equipment.classOption})` : '',
      fromBg.has(l.item.id) ? `стартовое снаряжение предыстории ${bg} (вариант ${s.equipment.bgOption})` : '',
      s.equipment.purchases.includes(l.item.id) ? `куплено за ${price(byId.item[l.item.id]?.cost)}` : ''
    ].filter(Boolean)
    why.part('equipment', x.itemText(l), src.length ? src.join('; ') : 'Стартовое снаряжение')
  }

  for (const line of String(c.classFeatures || '').split('\n')) why.part('classFeatures', line, `Умение класса ${cls} на 1-м уровне`)
  for (const line of String(c.speciesTraits || '').split('\n')) why.part('speciesTraits', line, `Особенность вида ${sp}`)
  for (const line of String(c.feats || '').split('\n')) {
    const slot = d.featSlots.find((f) => line.startsWith(q(nameOf(f.feat))))
    why.part('feats', line, slot
      ? slot.slot === 'background' ? `Черта происхождения, которую даёт предыстория ${bg}` : `Черта происхождения от вида ${sp}`
      : `Боевой стиль — умение класса ${cls} на 1-м уровне`)
  }

  // spells
  const main = x.known.find((k) => k.ability)?.ability
  const ab = d.cls?.spellcasting?.ability || main
  if (ab) {
    why.field('spellcastingClass', d.cls?.spellcasting ? `Класс ${cls} колдует через характеристику ${abilityName(ab)}` : `Заклинания не от класса; характеристика ${abilityName(ab)}`)
    why.field('spellSaveDC', `8 + бонус мастерства ${PB} + модификатор ${abilityName(ab)} ${signed(d.mods[ab])}`)
    why.field('spellAttackBonus', `Бонус мастерства ${PB} + модификатор ${abilityName(ab)} ${signed(d.mods[ab])}`)
  }
  why.field('preparedSpellsTotal', `Таблица класса ${cls}: столько заклинаний подготовлено на 1-м уровне`)
  why.field('lvl1SpellSlotsTotal', `Таблица класса ${cls}: ячейки 1 круга на 1-м уровне`)
  for (const k of x.known) {
    const suffix = k.source === 'species' ? ' (вид)' : k.source === 'feat' ? ' (черта)' : ''
    const key = k.spell.level === 0 ? 'cantrips' : `lvl${k.spell.level}Spells`
    why.part(key, nameOf(k.spell) + suffix, k.source === 'class'
      ? `Выбрано из списка заклинаний класса ${cls}`
      : k.source === 'feature' ? `Даёт умение класса ${cls}` : k.source === 'species' ? `Даёт вид ${sp}` : 'Даёт черта «Посвящённый в магию»')
  }
  return why
}

function startingMoney(d: Derived, s: WizardState): string {
  const cls = classEquipOption(d, s)?.gp || 0
  const bg = bgEquipOption(d, s)?.gp || 0
  const spent = s.equipment.purchases.reduce((n, id) => n + (byId.item[id]?.cost_cp || 0), 0)
  return `Стартовые деньги: ${cls} зм от класса + ${bg} зм от предыстории` + (spent ? ` − ${spent / 100} зм на покупки` : '')
}
