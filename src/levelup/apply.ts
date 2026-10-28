// One level up -> the updated character sheet. Numbers that depend on the level or on the
// changed scores are recalculated from the old values (so bonuses written by hand stay);
// new features, feats, proficiencies and spells are appended.
import type { DnDAttack, DnDCharacter, DnDSpell } from 'dnd-sheet'
import { ABILITIES, Ability, abilityName, abilityShort, armor, byId, classFeatures, classOptions, nameOf, ruName, skills } from '../data'
import { mod, signed } from '../rules/derive'
import { SKILL_FIELD } from '../rules/sheet'
import { NumbersCtx, classFeatureNumbers, dice, points, speciesNumberLine, times } from '../rules/text'
import {
  LevelPicks, casterSlots, classFeaturesAt, featStepKind, grantsAt, hpGain, newScores, nextLevel, row, spellPlan,
  speciesGainsAt, subclassFeaturesAt, subclassOf
} from './plan'
import { ARMOR_RU } from '../wizard/steps/common'
import { SheetInfo, norm } from './read'
import { Why, changelogOf, logEvent } from '../changelog/changelog'
import { wornOf } from '../inventory/worn'

export interface LevelUpResult {
  character: DnDCharacter
  // what changed, for the summary step
  summary: string[]
}

const toInt = (v: unknown): number | null => {
  const m = String(v ?? '').replace(/[−–]/g, '-').match(/[+-]?\d+/)
  return m ? Number(m[0]) : null
}
const join = (...parts: (string | undefined | false | null)[]) => parts.filter(Boolean).join('; ')
const appendText = (text: unknown, lines: string[]) => [String(text ?? '').trim(), ...lines].filter(Boolean).join('\n')
const appendList = (text: unknown, items: string[]) => {
  const cur = String(text ?? '').trim()
  const fresh = items.filter((x) => !norm(cur).includes(norm(x)))
  return [cur, ...fresh].filter(Boolean).join(', ')
}
const ordinal = (n: number) => `${n}-й ур.`

// Russian labels of the class-table columns (as on the class tables of dnd.su)
const COLUMN_RU: Record<string, (v: string | number) => string> = {
  rages: (v) => `ярость ${v}`,
  rage_damage: (v) => `урон ярости +${v}`,
  weapon_mastery: (v) => `оружейное мастерство ${v}`,
  bardic_inspiration_die: (v) => `кость вдохновения ${dice(String(v))}`,
  channel_divinity: (v) => `проведение божественности ${v}`,
  wild_shape: (v) => `дикий облик ${v}`,
  second_wind: (v) => `второе дыхание ${v}`,
  focus_points: (v) => `очки сосредоточенности ${v}`,
  martial_arts: (v) => `кость боевых искусств ${dice(String(v))}`,
  unarmored_movement: (v) => `движение без доспехов +${v} фт`,
  favored_enemy: (v) => `избранный враг ${v}`,
  sneak_attack: (v) => `скрытая атака ${dice(String(v))}`,
  sorcery_points: (v) => `очки чародейства ${v}`,
  eldritch_invocations: (v) => `воззвания ${v}`,
  plans_known: (v) => `схемы ${v}`,
  magic_items: (v) => `магические предметы ${v}`
}
const TABLE_LINE = 'Таблица класса'

// species traits that start at a higher level (names as on dnd.su)
export const SPECIES_TRAIT_RU: Record<string, string> = {
  'celestial-revelation': 'Небесное откровение',
  'draconic-flight': 'Драконий полёт',
  'large-form': 'Большая форма',
  'spider-climb-walls': 'Паучье лазание: по стенам и потолкам без рук'
}

function spellRow(id: string, tag: string, prepared: boolean): DnDSpell {
  return { name: nameOf(byId.spell[id]) + (tag ? ` (${tag})` : ''), prepared }
}

export function applyLevelUp(c: DnDCharacter, info: SheetInfo, picks: LevelPicks): LevelUpResult {
  const out: DnDCharacter = JSON.parse(JSON.stringify(c))
  const summary: string[] = []
  const level = nextLevel(info)
  const cls = info.cls
  const sub = subclassOf(info, picks)
  const pbOld = row(info, level - 1).proficiency_bonus
  const pbNew = row(info, level).proficiency_bonus
  const dPb = pbNew - pbOld
  const scores = newScores(info, picks)
  const mOld = Object.fromEntries(ABILITIES.map((a) => [a, mod(info.scores[a])])) as Record<Ability, number>
  const mNew = Object.fromEntries(ABILITIES.map((a) => [a, mod(scores[a])])) as Record<Ability, number>
  const ch = (suffix: RegExp) => Object.entries(picks.choices).filter(([k]) => suffix.test(k)).flatMap(([, v]) => v)
  const feat = picks.feat ? byId.feat[picks.feat] : null
  const featGrants = (feat?.grants || {}) as Record<string, unknown> & { tools?: string[]; armor?: string[]; weapons?: string[]; spells?: string[]; cantrips?: string[] }

  // why each field changes, for the change log
  const why = new Why()
  const q = (x: string) => `«${x}»`
  const clsName = q(nameOf(cls))
  const featureName = (id: string | undefined) =>
    nameOf(classFeatures.find((x) => x.class === cls.id && x.feature === id)) || nameOf(sub?.features.find((x) => x.id === id) as never) || ''
  // where a grant comes from: a class or subclass feature
  const grantSource = (g: { feature?: string }) => {
    const name = featureName(g.feature)
    return name ? `умение ${q(name)}` : sub ? `подкласс ${q(nameOf(sub))}` : `класс ${clsName}`
  }
  const featSource = feat ? `черта ${q(nameOf(feat))}` : ''
  const upper = (x: string) => x.charAt(0).toUpperCase() + x.slice(1)
  // "бонус мастерства +2 → +3; модификатор: Сила +3 → +4"
  const causes = (ab: Ability | null, usesPb: boolean, extra: string[] = []) => [
    usesPb && dPb ? `бонус мастерства ${signed(pbOld)} → ${signed(pbNew)}` : '',
    ab && mNew[ab] !== mOld[ab] ? `модификатор: ${abilityName(ab)} ${signed(mOld[ab])} → ${signed(mNew[ab])}` : '',
    ...extra
  ].filter(Boolean).join('; ')

  // ---- header
  out.classLevel = `${nameOf(cls)} ${level}`
  why.field('classLevel', `Новый уровень класса ${clsName}: ${level - 1} → ${level}`)
  if (picks.subclass && sub) {
    out.subclass = nameOf(sub)
    summary.push(`Подкласс: ${nameOf(sub)}`)
    why.field('subclass', `На ${level}-м уровне класс ${clsName} выбирает подкласс; выбран ${q(nameOf(sub))}`)
  }
  for (const a of ABILITIES) {
    out[a] = String(scores[a])
    if (scores[a] !== info.scores[a]) {
      summary.push(`${abilityName(a)}: ${info.scores[a]} → ${scores[a]}`)
      why.field(a, `${upper(featSource || 'черта')} на ${level}-м уровне: +${scores[a] - info.scores[a]}`)
    }
  }
  out.proficiencyBonus = signed(pbNew)
  if (dPb) summary.push(`Бонус мастерства: ${signed(pbOld)} → ${signed(pbNew)}`)
  why.field('proficiencyBonus', dPb
    ? `Бонус мастерства растёт на 5, 9, 13 и 17 уровнях; на ${level}-м уровне он ${signed(pbNew)}`
    : `По таблице уровней на ${level}-м уровне бонус мастерства ${signed(pbNew)}`)

  // ---- hit points and hit dice
  const gain = hpGain(info, picks)
  if (gain) {
    const oldMax = info.maxHp
    out.maxHp = String(oldMax + gain.total)
    const hp = toInt(c.hp)
    if (hp != null) out.hp = String(hp === oldMax ? oldMax + gain.total : hp + gain.total)
    summary.push(`Максимум хитов: ${oldMax} → ${oldMax + gain.total} (+${gain.total})`)
    why.field('maxHp', `Кость хитов класса ${clsName} — к${cls.hit_die}: ${picks.hp.method === 'fixed' ? 'среднее' : 'бросок'} ${gain.base}; ` +
      `модификатор Телосложения ${signed(gain.con)}` + gain.extras.map((e) => `; ${e.label} ${signed(e.value)}`).join(''))
    why.field('hp', hp === oldMax ? 'Хиты были полными — теперь равны новому максимуму' : 'Текущие хиты растут на столько же, на сколько максимум')
  }
  const hd = `к${cls.hit_die}`
  const dieCount = (v: unknown) => { const m = String(v ?? '').match(/(\d+)\s*[кd]/); return m ? Number(m[1]) : null }
  const hdMax = dieCount(c.hitDiceMax)
  out.hitDiceMax = `${(hdMax ?? level - 1) + 1}${hd}`
  const hdLeft = dieCount(c.hitDice)
  out.hitDice = `${(hdLeft ?? level - 1) + 1}${hd}`
  summary.push(`Кости хитов: ${out.hitDiceMax}`)
  why.field('hitDiceMax', `Каждый уровень класса ${clsName} добавляет одну кость хитов к${cls.hit_die}`)
  why.field('hitDice', 'Новая кость хитов добавляется к запасу')

  // ---- proficiencies
  const grants = grantsAt(info, picks)
  const newSaves = new Set<Ability>([
    ...grants.flatMap((g) => (g.save_fallback && (g.saves || []).every((a) => info.saves.has(a)) ? [] : g.saves || [])),
    ...(ch(/^g:.*:save$/) as Ability[]),
    ...(featGrants.save_of_increased_ability ? (ch(/^ft:plus1$/) as Ability[]) : [])
  ])
  const savesNow = new Set([...info.saves, ...newSaves])
  for (const a of ABILITIES) {
    const old = toInt(c[a + 'Save'])
    const was = info.saves.has(a)
    const now = savesNow.has(a)
    const other = old == null ? 0 : old - mOld[a] - (was ? pbOld : 0)
    out[a + 'Save'] = signed(mNew[a] + (now ? pbNew : 0) + other)
    out[a + 'SaveChecked'] = now
    const fresh = now && !was
    const from = fresh ? (featGrants.save_of_increased_ability ? featSource : grantSource(grants.find((g) => g.saves?.includes(a)) || {})) : ''
    why.field(a + 'Save', 'Пересчёт: ' + causes(a, was, fresh ? [`новое владение (${from}): +${pbNew}`] : []))
    if (fresh) why.field(a + 'SaveChecked', `Владение спасброском даёт ${from}`)
  }
  for (const a of newSaves) if (!info.saves.has(a)) summary.push(`Владение спасброском: ${abilityName(a)}`)

  const skillOrExp = ch(/:skill-or-expertise$/)
  const newSkills = new Set([
    ...ch(/:skill$/),
    ...skillOrExp.filter((s) => !info.skills.has(s)),
    ...ch(/^ft:skill-or-tool$/).filter((v) => v.startsWith('skill:')).map((v) => v.slice(6)),
    ...grants.flatMap((g) => g.skills || [])
  ])
  const allSkills = Boolean(featGrants.all_skills)
  const newExpertise = new Set([...ch(/:expertise$/), ...skillOrExp.filter((s) => info.skills.has(s))])
  const jack = (l: number) => cls.level_up_grants.some((g) => g.jack_of_all_trades && (g.level ?? 99) <= l)
  for (const sk of skills) {
    const field = SKILL_FIELD[sk.id]
    const old = toInt(c[field])
    const wasProf = info.skills.has(sk.id)
    const mult = (prof: boolean, exp: boolean, j: boolean) => (exp ? 2 : prof ? 1 : j ? 0.5 : 0)
    const before = mult(wasProf, info.expertise.has(sk.id), jack(level - 1))
    const prof = wasProf || newSkills.has(sk.id) || allSkills
    const after = mult(prof, info.expertise.has(sk.id) || newExpertise.has(sk.id), jack(level))
    const other = old == null ? 0 : old - mOld[sk.ability] - Math.floor(before * pbOld)
    out[field] = signed(mNew[sk.ability] + Math.floor(after * pbNew) + other)
    out[field + 'Checked'] = prof
    const newProf = prof && !wasProf
    const grant = grants.find((g) => g.skills?.includes(sk.id))
    const skillFrom = allSkills ? featSource : grant ? grantSource(grant)
      : featSource && ch(/^ft:skill-or-tool$/).includes('skill:' + sk.id) ? featSource : 'выбор умения на этом уровне'
    why.field(field, 'Пересчёт: ' + causes(sk.ability, before > 0, [
      newProf ? `новое владение (${skillFrom})` : '',
      newExpertise.has(sk.id) ? 'экспертность: бонус мастерства удваивается' : '',
      !jack(level - 1) && jack(level) && !prof ? 'Мастер на все руки: половина бонуса мастерства' : ''
    ]))
    if (newProf) why.field(field + 'Checked', `Владение даёт ${skillFrom}`)
  }
  const skillNames = (ids: Iterable<string>) => [...ids].map((id) => nameOf(byId.skill[id])).join(', ')
  if (newSkills.size) summary.push('Владение навыками: ' + skillNames(newSkills))
  if (newExpertise.size) summary.push('Экспертность: ' + skillNames(newExpertise))
  if (allSkills) summary.push('Владение всеми навыками')

  const perceptionOld = toInt(c.skillPerception)
  const ppOld = toInt(c.passivePerception)
  const perceptionNew = toInt(out.skillPerception) ?? 0
  out.passivePerception = String(ppOld != null && perceptionOld != null ? ppOld + perceptionNew - perceptionOld : 10 + perceptionNew)
  why.field('passivePerception', 'Меняется вместе с навыком Восприятие (10 + навык)')

  // initiative: Dexterity and, with Alert, the proficiency bonus
  const hadAlert = info.feats.has('alert')
  const initOld = toInt(c.init) ?? mOld.dex + (hadAlert ? pbOld : 0)
  out.init = signed(initOld + (mNew.dex - mOld.dex) + (hadAlert ? dPb : 0) + (picks.feat === 'alert' ? pbNew : 0))
  why.field('init', 'Пересчёт: ' + causes('dex', hadAlert, picks.feat === 'alert' ? [`черта «Бдительный»: +${pbNew}`] : []))

  // armor class: only the parts that use the changed scores
  const ac = toInt(c.ac)
  if (ac != null) {
    // the armour the hero wears in the inventory; a sheet without it: the armour its equipment names
    const wornId = wornOf(c).armor?.id
    const worn = c.worn
      ? (wornId ? byId.armor[wornId] : undefined)
      : armor.find((x) => x.type !== 'shield' && norm(String(c.equipment ?? '')).includes(norm(nameOf(x))))
    const dDex = mNew.dex - mOld.dex
    let delta = dDex
    if (worn?.type === 'heavy') delta = 0
    else if (worn?.type === 'medium') delta = Math.min(mNew.dex, 2) - Math.min(mOld.dex, 2)
    else if (!worn && cls.id === 'barbarian') delta = dDex + mNew.con - mOld.con
    else if (!worn && cls.id === 'monk') delta = dDex + mNew.wis - mOld.wis
    out.ac = String(ac + delta)
    if (delta) summary.push(`Класс доспеха: ${ac} → ${ac + delta}`)
    why.field('ac', (worn ? `Доспех ${q(nameOf(worn))}${worn.type === 'medium' ? ' учитывает Ловкость до +2' : ' учитывает Ловкость'}` : 'Без доспеха КД зависит от Ловкости') +
      '; ' + [causes('dex', false), !worn && cls.id === 'barbarian' ? causes('con', false) : '', !worn && cls.id === 'monk' ? causes('wis', false) : ''].filter(Boolean).join('; '))
  }
  if (featGrants.speed_bonus) {
    const sp = toInt(c.speed)
    if (sp != null) out.speed = `${sp + Number(featGrants.speed_bonus)} фт`
    why.field('speed', `${upper(featSource)}: скорость +${featGrants.speed_bonus} фт`)
  }

  const armorNew = new Set([...grants.flatMap((g) => g.armor || []), ...(featGrants.armor || [])])
  const armorField: Record<string, string> = { light: 'armorLight', medium: 'armorMedium', heavy: 'armorHeavy', shield: 'armorShields' }
  for (const a of armorNew) {
    out[armorField[a]] = true
    const g = grants.find((x) => x.armor?.includes(a))
    why.field(armorField[a], `Тренированность даёт ${g ? grantSource(g) : featSource}`)
  }
  if (armorNew.size) summary.push('Тренированность: ' + [...armorNew].map((a) => ARMOR_RU[a].toLowerCase()).join(', '))
  const weaponNew = [...grants.flatMap((g) => g.weapons || []), ...(featGrants.weapons || [])]
  if (weaponNew.length) {
    const text = weaponNew.map((w) => (w === 'martial' ? 'воинское оружие' : 'воинское дальнобойное оружие'))
    out.weaponProficiencies = appendList(c.weaponProficiencies, text)
    const g = grants.find((x) => x.weapons?.length)
    why.field('weaponProficiencies', `Владение оружием даёт ${g ? grantSource(g) : featSource}`)
    summary.push('Владение оружием: ' + text.join(', '))
  }
  const toolNew = [
    ...grants.flatMap((g) => (g.tools || []).filter((t) => !info.tools.has(t))),
    ...ch(/:tool$/),
    ...ch(/^ft:skill-or-tool$/).filter((v) => v.startsWith('tool:')).map((v) => v.slice(5)),
    ...(featGrants.tools || []).filter((t) => !info.tools.has(t))
  ]
  if (toolNew.length) {
    out.toolProficiencies = appendList(c.toolProficiencies, toolNew.map((t) => nameOf(byId.item[t])))
    for (const t of toolNew) {
      const g = grants.find((x) => x.tools?.includes(t))
      why.part('toolProficiencies', nameOf(byId.item[t]), `Владение даёт ${g ? grantSource(g) : featGrants.tools?.includes(t) ? featSource : 'выбор умения на этом уровне'}`)
    }
    summary.push('Владение инструментами: ' + toolNew.map((t) => nameOf(byId.item[t])).join(', '))
  }
  const langNew = ch(/:language$/)
  if (langNew.length) {
    out.languages = appendList(c.languages, langNew.map((l) => nameOf(byId.language[l])))
    why.field('languages', `Язык на выбор от умения класса на ${level}-м уровне`)
    summary.push('Языки: ' + langNew.map((l) => nameOf(byId.language[l])).join(', '))
  }

  // ---- choices, grouped by the feature they belong to
  const optionName = (id: string) => nameOf(Object.values(classOptions).flat().find((o) => o.id === id))
  const featureOfKey = (key: string): string => {
    const [prefix, id] = key.split(':')
    if (prefix === 'f') return cls.level_up_choices.find((x) => x.id === id)?.feature ?? id
    if (prefix === 's') return sub?.choices?.find((x) => x.id === id)?.feature ?? id
    return id
  }
  const valueText = (kind: string, vals: string[]): string => {
    if (kind === 'skill' || kind === 'expertise' || kind === 'skill-or-expertise') return skillNames(vals)
    if (kind === 'tool') return vals.map((v) => nameOf(byId.item[v])).join(', ')
    if (kind === 'language') return vals.map((v) => nameOf(byId.language[v])).join(', ')
    if (kind === 'damage-type') return vals.map((v) => ruName('damage_types', v)).join(', ')
    if (kind === 'style') return vals.map((v) => nameOf(byId.feat[v]) || cls.level_up_choices.find((x) => x.alternative?.id === v)?.alternative?.name_ru || v).join(', ')
    if (kind === 'save') return 'спасбросок ' + vals.map((v) => abilityName(v as Ability)).join(', ')
    if (kind === 'weapons') return vals.map((v) => `${nameOf(byId.weapon[v])} (${ruName('weapon_masteries', byId.weapon[v]?.mastery).toLowerCase()})`).join(', ')
    if (classOptions[kind]) return vals.map(optionName).join(', ')
    return vals.map((v) => nameOf(byId.spell[v])).join(', ')
  }
  const details = new Map<string, string[]>()
  const swaps: [string, string][] = []
  for (const [key, vals] of Object.entries(picks.choices)) {
    if (!vals.length || !/^(f|s|g):/.test(key) || key.startsWith('f:fighting-style-swap')) continue
    const kind = key.split(':').pop()!
    if (kind === 'replace-out') continue
    if (kind === 'replace-in') {
      const old = (picks.choices[key.replace(/replace-in$/, 'replace-out')] || [])[0]
      if (old) swaps.push([optionName(old), optionName(vals[0])])
      continue
    }
    const feature = featureOfKey(key)
    details.set(feature, [...(details.get(feature) || []), valueText(kind, vals)])
  }
  const take = (feature: string) => {
    const d = details.get(feature)
    details.delete(feature)
    return d ? d.join('; ') : ''
  }

  // ---- feature lines
  const featureLines: string[] = []
  for (const f of classFeaturesAt(info, level)) {
    if (f.feature === 'ability-score-improvement' || f.feature === 'epic-boon') continue
    const detail = take(f.feature)
    const line = `${nameOf(f)} (${ordinal(level)})` + (detail ? ': ' + detail : '')
    featureLines.push(line)
    why.part('classFeatures', line, `Класс ${clsName} получает это умение на ${level}-м уровне`)
  }
  for (const f of subclassFeaturesAt(sub, level)) {
    const g = grants.find((x) => x.feature === f.id)
    const detail = join(
      g?.tools?.filter((t) => !info.tools.has(t)).map((t) => nameOf(byId.item[t])).join(', '),
      g?.skills?.map((s) => nameOf(byId.skill[s])).join(', '),
      g?.rituals ? 'ритуалы: ' + g.rituals.map((s) => nameOf(byId.spell[s])).join(', ') : '',
      sub?.always_prepared?.[String(level)] && /spells$/.test(f.id) ? 'подготовлены: ' + sub.always_prepared[String(level)].map((s) => nameOf(byId.spell[s])).join(', ') : '',
      take(f.id)
    )
    const line = `${nameOf(f)} (${nameOf(sub)}, ${ordinal(level)})` + (detail ? ': ' + detail : '')
    featureLines.push(line)
    why.part('classFeatures', line, `Подкласс ${q(nameOf(sub))} даёт это умение на ${level}-м уровне`)
  }
  // choices of features gained earlier: more invocations, plans, masteries, maneuvers...
  for (const [feature, parts] of details) {
    const name = nameOf(classFeatures.find((f) => f.class === cls.id && f.feature === feature)) ||
      nameOf(sub?.features.find((f) => f.id === feature) as never) || feature
    const line = `${name} (${ordinal(level)}): ` + parts.join('; ')
    featureLines.push(line)
    why.part('classFeatures', line, `Умение ${q(name)} получено раньше; на ${level}-м уровне в нём новые выборы`)
  }
  // always-prepared spells of a subclass gained at later levels (no new feature that level)
  if (sub && level > sub.level && sub.always_prepared?.[String(level)] && !subclassFeaturesAt(sub, level).length) {
    const line = `Заклинания подкласса (${ordinal(level)}): ` + sub.always_prepared[String(level)].map((s) => nameOf(byId.spell[s])).join(', ')
    featureLines.push(line)
    why.part('classFeatures', line, `Подкласс ${q(nameOf(sub))}: эти заклинания всегда подготовлены с ${level}-го уровня`)
  }
  for (const u of cls.level_up_unsupported || []) {
    if (u.level === level) summary.push(`Не заполнено: ${nameOf(classFeatures.find((f) => f.class === cls.id && f.feature === u.feature))} — впишите вручную (в базе нет нужных данных).`)
  }
  for (const [from, to] of swaps) summary.push(`Замена: ${from} → ${to}`)
  // the class table: one line, replaced every level
  const cols = Object.entries(row(info, level).columns).filter(([k, v]) => COLUMN_RU[k] && v != null && v !== 0)
  const tableLine = `${TABLE_LINE} (${ordinal(level)}): ` + cols.map(([k, v]) => COLUMN_RU[k](v as string | number)).join(', ')
  // lines whose numbers follow the level (rages, slots, sneak attack...) are rewritten,
  // but only while they read exactly as generated for the previous level
  const oldLines = String(c.classFeatures ?? '').split('\n')
  const book = (l: number) => {
    const m = oldLines.map((x) => x.match(/в книге заклинаний (\d+)/)).find(Boolean)
    const was = m ? Number(m[1]) : 6
    return l === level - 1 ? was : was + ch(/^sp:spellbook$/).length + ch(/^sp:savant$/).length
  }
  const ctx = (l: number, mods: Record<Ability, number>): NumbersCtx => ({ cls, level: l, mods, spellbook: book(l) })
  const refreshed = new Map<string, string>()
  for (const f of cls.level_1_features) {
    const name = f.name_ru || f.name
    const was = classFeatureNumbers(f.id, name, ctx(level - 1, mOld))
    const now = classFeatureNumbers(f.id, name, ctx(level, mNew))
    if (was && now && was !== now) refreshed.set(was, now)
  }
  const keptLines = oldLines.filter((l) => !l.startsWith(TABLE_LINE) && l.trim()).map((l) => refreshed.get(l) ?? l)
  out.classFeatures = [...keptLines, ...featureLines, ...(cols.length ? [tableLine] : [])].join('\n')
  why.part('classFeatures', tableLine, `Таблица класса ${clsName} на ${level}-м уровне`)
  for (const l of refreshed.values()) why.part('classFeatures', l, 'Число в умении зависит от уровня или модификатора — пересчитано')
  summary.push(...featureLines)
  summary.push(...[...refreshed.values()].filter((l) => keptLines.includes(l)).map((l) => 'Обновлено: ' + l))

  // species traits from this level; the ones counted by the proficiency bonus follow it
  const sg = speciesGainsAt(info, level)
  const speciesLines = sg.traits.map((t) => `${SPECIES_TRAIT_RU[t.id] || t.name} (с ${ordinal(level)})`)
  for (const l of speciesLines) why.part('speciesTraits', l, `Особенность вида ${q(nameOf(info.species))} начинает действовать с ${level}-го уровня`)
  if (sg.lineageSpells.length) {
    const l = `Заклинание родословной (${ordinal(level)}): ` + sg.lineageSpells.map((s) => nameOf(byId.spell[s])).join(', ')
    speciesLines.push(l)
    why.part('speciesTraits', l, `Вариант вида ${q(nameOf(info.speciesOption))} даёт заклинание на ${level}-м уровне`)
  }
  const spWas = speciesNumberLine(info.species.id, { level: level - 1, pb: pbOld, con: mOld.con, str: mOld.str, option: info.speciesOption })
  const spNow = speciesNumberLine(info.species.id, { level, pb: pbNew, con: mNew.con, str: mNew.str, option: info.speciesOption })
  if (spNow) why.part('speciesTraits', spNow, 'Число в особенности вида зависит от уровня, бонуса мастерства или модификатора — пересчитано')
  const gnomeUses = (pb: number) => `${times(pb)} за долгий отдых без ячейки`
  const speciesText = String(c.speciesTraits ?? '').split('\n').map((l) => {
    if (spWas && spNow && l === spWas && spWas !== spNow) { summary.push('Обновлено: ' + spNow); return spNow }
    if (dPb && l.startsWith('Гномья родословная:') && l.includes(gnomeUses(pbOld))) {
      const next = l.replace(gnomeUses(pbOld), gnomeUses(pbNew))
      summary.push('Обновлено: ' + next)
      why.part('speciesTraits', next, 'Число использований равно бонусу мастерства — пересчитано')
      return next
    }
    return l
  }).join('\n')
  if (speciesText !== String(c.speciesTraits ?? '')) out.speciesTraits = speciesText
  if (speciesLines.length) {
    out.speciesTraits = appendText(out.speciesTraits ?? c.speciesTraits, speciesLines)
    summary.push(...speciesLines)
  }

  // ---- feats
  const featLines: string[] = []
  if (feat) {
    const inc = Object.entries(scores).filter(([a, v]) => v !== info.scores[a as Ability]).map(([a, v]) => `${abilityShort(a as Ability)} +${v - info.scores[a as Ability]}`)
    const extras = Object.entries(picks.choices).filter(([k]) => k.startsWith('ft-x:') || ['ft:skill-or-tool', 'ft:spell-list', 'ft:ability', 'ft:spell-0', 'ft:spell-1', 'ft:tool'].includes(k))
      .flatMap(([k, vals]) => vals.map((v) => {
        if (k === 'ft:spell-list') return 'список: ' + ruName('classes', v, v)
        if (k === 'ft:ability') return abilityName(v as Ability)
        if (v.startsWith('skill:')) return nameOf(byId.skill[v.slice(6)])
        if (v.startsWith('tool:')) return nameOf(byId.item[v.slice(5)])
        return nameOf(byId.spell[v]) || nameOf(byId.skill[v]) || nameOf(byId.item[v]) || ruName('damage_types', v, v)
      }))
    const fixed = [...(featGrants.spells || []), ...(featGrants.cantrips || [])].map((s) => nameOf(byId.spell[s]))
    const kind = featStepKind(info) === 'epic-boon' ? 'эпический дар' : 'черта'
    const line = `«${nameOf(feat)}» (${kind}, ${ordinal(level)}): ` + join(inc.join(', '), extras.join(', '), fixed.join(', '))
    featLines.push(line)
    why.part('feats', line, kind === 'эпический дар' ? 'На 19-м уровне класс получает эпический дар' : `На ${level}-м уровне класс ${clsName} даёт черту`)
  }
  const style = ch(/^(f|s):.*:style$/)[0]
  if (style && byId.feat[style]) {
    const swap = Object.keys(picks.choices).some((k) => k.startsWith('f:fighting-style-swap'))
    if (swap && info.fightingStyle) {
      out.feats = String(c.feats ?? '').replace(nameOf(byId.feat[info.fightingStyle]), nameOf(byId.feat[style]))
      why.field('feats', 'Боевой стиль можно заменить при повышении уровня')
      summary.push(`Боевой стиль заменён: «${nameOf(byId.feat[info.fightingStyle])}» → «${nameOf(byId.feat[style])}»`)
    } else {
      const line = `«${nameOf(byId.feat[style])}» (боевой стиль, ${ordinal(level)})`
      featLines.push(line)
      why.part('feats', line, `Боевой стиль от умения класса на ${level}-м уровне`)
    }
  }
  if (featLines.length) {
    out.feats = appendText(out.feats ?? c.feats, featLines)
    summary.push(...featLines)
  }
  // origin feats counted by the proficiency bonus (Lucky, Alert)
  if (dPb && out.feats) {
    out.feats = String(out.feats).split('\n').map((l) => {
      const next = l
        .replace(`${points(pbOld)} удачи на долгий отдых`, `${points(pbNew)} удачи на долгий отдых`)
        .replace(`+${pbOld} к инициативе, можно меняться`, `+${pbNew} к инициативе, можно меняться`)
      if (next !== l) {
        summary.push('Обновлено: ' + next)
        why.part('feats', next, 'Число зависит от бонуса мастерства — пересчитано')
      }
      return next
    }).join('\n')
  }

  // ---- spells
  const plan = spellPlan(info, picks)
  const lists: DnDSpell[][] = Array.from({ length: 10 }, (_, l) =>
    ((l === 0 ? out.cantrips : out[`lvl${l}Spells`]) || []).map((s: DnDSpell) => ({ ...s })).filter((s: DnDSpell) => s.name))
  const removeSpell = (id: string) => {
    const s = byId.spell[id]
    if (!s) return
    lists[s.level] = lists[s.level].filter((x) => norm(String(x.name).replace(/\s*\(.*\)$/, '')) !== norm(nameOf(s)))
  }
  const addSpell = (id: string, tag: string, prepared: boolean) => {
    const s = byId.spell[id]
    if (!s) return
    const existing = lists[s.level].find((x) => norm(String(x.name).replace(/\s*\(.*\)$/, '')) === norm(nameOf(s)))
    if (existing) { if (prepared) existing.prepared = true; return }
    lists[s.level].push(spellRow(id, tag, s.level === 0 ? false : prepared))
  }
  const added: string[] = []
  // every spell added with the reason it comes
  const add = (ids: string[], tag: string, prepared: boolean, reason: string) => ids.forEach((id) => {
    addSpell(id, tag, prepared)
    added.push(nameOf(byId.spell[id]))
    const sp = byId.spell[id]
    if (sp) why.part(sp.level === 0 ? 'cantrips' : `lvl${sp.level}Spells`, spellRow(id, tag, prepared).name!, reason)
  })
  for (const id of [...ch(/^sp:cantrip-out$/), ...ch(/^sp:prepared-out$/)]) {
    const sp = byId.spell[id]
    if (sp) why.part(sp.level === 0 ? 'cantrips' : `lvl${sp.level}Spells`, nameOf(sp), 'Заменено другим заклинанием при повышении уровня')
  }
  ch(/^sp:cantrip-out$/).forEach(removeSpell)
  ch(/^sp:prepared-out$/).forEach(removeSpell)
  add([...ch(/^sp:cantrips$/), ...ch(/^sp:cantrip-in$/)], '', false, `Таблица класса ${clsName}: на ${level}-м уровне больше заговоров`)
  add(ch(/^sp:spellbook$/).filter((id) => !ch(/^sp:prepared$/).includes(id)), '', false, 'Волшебник вписывает в книгу два заклинания за уровень')
  add(ch(/^sp:savant$/).filter((id) => !ch(/^sp:prepared$/).includes(id)), '', false, `Подкласс ${q(nameOf(sub))}: заклинания в книгу`)
  add([...ch(/^sp:prepared$/), ...ch(/^sp:prepared-in$/)], '', true, `Таблица класса ${clsName}: на ${level}-м уровне можно подготовить больше заклинаний`)
  add(ch(/^f:.*:cantrip$/), cls.id === 'paladin' || cls.id === 'ranger' ? 'боевой стиль' : '', false, 'Заговор от умения класса')
  add(ch(/^g:.*:cantrip$/), 'подкласс', false, `Заговор от подкласса ${q(nameOf(sub))}`)
  add(ch(/^s:.*:spell$/), 'подкласс', true, `Заклинание, выбранное по умению подкласса ${q(nameOf(sub))}`)
  add(ch(/^f:mystic-arcanum-\d:spell$/), 'арканум', true, 'Таинственный арканум колдуна')
  for (const a of plan?.automatic || []) {
    add([a.id], a.tag, true, a.tag === 'вид' ? `Вариант вида ${q(nameOf(info.speciesOption))} даёт это заклинание на ${level}-м уровне`
      : `Всегда подготовлено (${a.tag}) с ${level}-го уровня`)
  }
  add([...(featGrants.cantrips || []), ...(featGrants.spells || []), ...ch(/^ft-x:.*:spell$/), ...ch(/^ft:spell-\d$/)], 'черта', true, upper(featSource || 'черта'))
  if (added.length) summary.push('Заклинания: ' + added.join(', '))
  for (let l = 0; l <= 9; l++) {
    if (l === 0) out.cantrips = lists[0]
    else out[`lvl${l}Spells`] = lists[l]
  }

  const casterAbility: Ability | null = cls.spellcasting?.ability || sub?.spellcasting?.ability || null
  if (casterAbility) {
    const r = row(info, level)
    if (r.pact_slots) {
      for (let l = 1; l <= 9; l++) out[`lvl${l}SpellSlotsTotal`] = ''
      out[`lvl${r.pact_slots.slot_level}SpellSlotsTotal`] = String(r.pact_slots.count)
    } else {
      const slots = casterSlots(info, picks, level)
      for (let l = 1; l <= 9; l++) out[`lvl${l}SpellSlotsTotal`] = slots[l - 1] ? String(slots[l - 1]) : ''
    }
    for (let l = 1; l <= 9; l++) {
      why.field(`lvl${l}SpellSlotsTotal`, r.pact_slots ? `Ячейки договора колдуна на ${level}-м уровне: все одного круга` : `Таблица ячеек заклинаний на ${level}-м уровне`)
    }
    const prepared = cls.spellcasting ? r.prepared_spells : sub?.spellcasting?.levels[String(level)]?.prepared_spells
    if (prepared) out.preparedSpellsTotal = String(prepared)
    why.field('preparedSpellsTotal', `Таблица класса: подготовленных заклинаний на ${level}-м уровне`)
    why.field('spellSaveDC', 'Пересчёт: ' + causes(casterAbility, true))
    why.field('spellAttackBonus', 'Пересчёт: ' + causes(casterAbility, true))
    why.field('spellcastingClass', sub?.spellcasting ? `Подкласс ${q(nameOf(sub))} даёт заклинательство` : `Заклинательство класса ${clsName}`)
    const dcOld = toInt(c.spellSaveDC)
    const atkOld = toInt(c.spellAttackBonus)
    const dMod = mNew[casterAbility] - mOld[casterAbility]
    out.spellSaveDC = String(dcOld != null ? dcOld + dPb + dMod : 8 + pbNew + mNew[casterAbility])
    out.spellAttackBonus = signed(atkOld != null ? atkOld + dPb + dMod : pbNew + mNew[casterAbility])
    if (!String(c.spellcastingClass ?? '').trim()) out.spellcastingClass = `${nameOf(sub?.spellcasting ? sub : cls)} (${abilityShort(casterAbility)})`
  }

  // ---- attacks: weapons and damage cantrips follow the new numbers
  const attacks: DnDAttack[] = (c.attacks || []).map((a) => ({ ...a }))
  for (const a of attacks) {
    if (!a.name) continue
    const baseName = String(a.name).replace(/\s*×\d+$/, '')
    const sp = Object.values(byId.spell).find((s) => s.level === 0 && norm(nameOf(s)) === norm(baseName))
    if (sp && /заговор/.test(String(a.notes ?? ''))) {
      const steps = sp.damage?.at_character_level
      if (steps) {
        const best = Object.keys(steps).map(Number).filter((l) => l <= level).sort((x, y) => x - y).pop()
        if (best != null) a.damage = String(a.damage ?? '').replace(/^\S+/, dice(steps[String(best)]))
      }
      why.part('attacks', String(a.name), 'Урон заговора растёт на 5, 11 и 17 уровнях; бонус или Сл — от бонуса мастерства и модификатора')
      const dc = String(a.bonus ?? '').match(/Сл\s*(\d+)/)
      const num = dc ? Number(dc[1]) : toInt(a.bonus)
      if (num != null) {
        const base = dc ? 8 + pbOld : pbOld
        const ab = ABILITIES.find((x) => base + mOld[x] === num) || casterAbility
        const next = num + dPb + (ab ? mNew[ab] - mOld[ab] : 0)
        a.bonus = dc ? String(a.bonus).replace(/Сл\s*\d+/, 'Сл ' + next) : signed(next)
      }
      continue
    }
    const w = Object.values(byId.weapon).find((x) => norm(nameOf(x)) === norm(baseName))
    const bonus = toInt(a.bonus)
    if (!w || bonus == null) continue
    const proficient = !/нет владения/.test(String(a.notes ?? ''))
    const candidates: Ability[] = w.properties.includes('finesse') ? ['str', 'dex'] : w.type === 'ranged' ? ['dex'] : ['str']
    const ab = candidates.find((x) => mOld[x] + (proficient ? pbOld : 0) === bonus) ||
      (w.properties.includes('finesse') ? (mOld.dex >= mOld.str ? 'dex' : 'str') : candidates[0])
    const dMod = mNew[ab] - mOld[ab]
    a.bonus = signed(bonus + dMod + (proficient ? dPb : 0))
    why.part('attacks', String(a.name), 'Пересчёт: ' + causes(ab, proficient))
    a.damage = String(a.damage ?? '').replace(/^(\S+?)([+-]\d+)?(\s|$)/, (_, d: string, m: string | undefined, sp2: string) => {
      const next = (m ? Number(m) : 0) + dMod
      return d + (next ? signed(next) : '') + sp2
    })
  }
  // rows for damage cantrips learned now
  const replaced = ch(/^sp:cantrip-out$/).map((id) => norm(nameOf(byId.spell[id])))
  const rows = attacks.filter((a) => !replaced.includes(norm(String(a.name ?? ''))))
  const cantripAbility = (key: string): Ability | null => {
    if (key.startsWith('f:')) return cls.level_up_choices.find((x) => x.alternative && key.startsWith('f:' + x.id))?.alternative?.ability || null
    if (key.startsWith('ft')) return ((picks.choices['ft:ability'] || picks.choices['ft:plus1'] || [])[0] as Ability) || casterAbility
    return casterAbility
  }
  for (const [key, vals] of Object.entries(picks.choices)) {
    if (!/^sp:cantrips$|^sp:cantrip-in$|:cantrip$|^ft:spell-0$/.test(key)) continue
    for (const id of vals) {
      const s = byId.spell[id]
      const ab = cantripAbility(key)
      if (!s?.damage || !ab || rows.some((r) => norm(String(r.name ?? '')) === norm(nameOf(s)))) continue
      const steps = s.damage.at_character_level || {}
      const best = Object.keys(steps).map(Number).filter((l) => l <= level).sort((x, y) => x - y).pop()
      const base = best != null ? steps[String(best)] : s.damage.at_slot_level?.['0'] || ''
      rows.push({
        name: nameOf(s),
        bonus: s.attack_type ? signed(pbNew + mNew[ab]) : `Сл ${8 + pbNew + mNew[ab]}${s.save ? ' ' + abilityShort(s.save) : ''}`,
        damage: `${dice(base)} ${ruName('damage_types', s.damage.type).toLowerCase()}`,
        notes: 'заговор'
      })
      why.part('attacks', nameOf(s), 'Новый заговор с уроном')
    }
  }
  out.attacks = rows.slice(0, 5)
  const overflow = rows.slice(5).map((r) => `${r.name}: ${r.bonus}, ${r.damage}${r.notes ? '; ' + r.notes : ''}`)
  if (overflow.length) out.attacksText = appendText(c.attacksText, overflow.filter((l) => !String(c.attacksText ?? '').includes(l)))
  why.field('attacksText', 'Не поместилось в таблицу из пяти строк')

  const title = `Уровень ${level}: ${nameOf(cls)}${sub ? ` (${nameOf(sub)})` : ''}`
  return { character: logEvent(c, out, why, title, changelogOf(c)), summary }
}
