// Short Russian summaries for the sheet's text blocks: level 1 class features,
// species traits and feats, with the character's own numbers filled in.
import { Ability, abilityName, abilityShort, byId, classOptions, nameOf, ruName } from '../data'
import type { ClassData, SpeciesOption } from '../data'
import type { WizardState } from '../wizard/state'
import { Derived, PROFICIENCY_BONUS as PB } from './derive'

export function times(n: number): string {
  const m10 = n % 10
  const m100 = n % 100
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return n + ' раза'
  return n + ' раз'
}

export const dice = (d: string) => d.replace(/(\d*)d(\d+)/g, '$1к$2')
const spellName = (id: string) => '«' + nameOf(byId.spell[id]) + '»'
const skillNames = (ids: string[]) => ids.map((id) => nameOf(byId.skill[id])).join(', ')
const damageName = (id: string) => ruName('damage_types', id).toLowerCase()

export const invocationName = (id: string, fallback: string) =>
  nameOf((classOptions['eldritch-invocation'] || []).find((o) => o.id === id)) || fallback

// "2 очка", "5 очков"
export function points(n: number): string {
  const m10 = n % 10
  const m100 = n % 100
  if (m10 === 1 && m100 !== 11) return n + ' очко'
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return n + ' очка'
  return n + ' очков'
}

// What a level-dependent line needs. The creation wizard fills it for level 1, the level-up
// for the new level, so the numbers in the sheet's text blocks stay current.
export interface NumbersCtx {
  cls: ClassData
  level: number
  mods: Record<Ability, number>
  // wizard: spells in the spellbook
  spellbook?: number
}

// The line of a class feature whose numbers follow the level or a modifier, or null.
export function classFeatureNumbers(featureId: string, name: string, x: NumbersCtx): string | null {
  const r = x.cls.levels[x.level - 1]
  const col = (k: string) => Number(r.columns[k] ?? 0)
  switch (featureId) {
    case 'rage':
      return `${name}: ${times(col('rages'))} за долгий отдых, +${col('rage_damage')} к урону атаками Силы, сопротивление дробящему, колющему и рубящему урону`
    case 'bardic-inspiration':
      return `${name}: ${dice(String(r.columns.bardic_inspiration_die || 'd6'))}, ${times(Math.max(1, x.mods.cha))} за долгий отдых`
    case 'spellcasting':
    case 'pact-magic': {
      const parts: string[] = []
      if (r.cantrips) parts.push('заговоров ' + r.cantrips)
      if (r.prepared_spells) parts.push('подготовленных заклинаний ' + r.prepared_spells)
      if (r.pact_slots) {
        parts.push(`ячеек договора ${r.pact_slots.count} (${r.pact_slots.slot_level} круг, восстанавливаются после короткого отдыха)`)
      } else if (r.spell_slots) {
        const slots = r.spell_slots.map((n, i) => (n ? `${i + 1} круга ${n}` : '')).filter(Boolean)
        if (slots.length) parts.push('ячеек ' + slots.join(', '))
      }
      if (x.cls.id === 'wizard') parts.push('в книге заклинаний ' + (x.spellbook ?? 6))
      const ability = x.cls.spellcasting ? abilityName(x.cls.spellcasting.ability) : ''
      return `${name} (${ability}): ${parts.join(', ')}`
    }
    case 'second-wind':
      return `${name}: ${times(col('second_wind'))}; бонусным действием восстановить 1к10 + ${x.level} ${x.level === 1 ? 'хит' : 'хитов'}`
    case 'martial-arts':
      return `${name}: кость ${dice(String(r.columns.martial_arts || 'd6'))}, безоружный удар бонусным действием, Лов вместо Сил для монашеского оружия`
    case 'lay-on-hands':
      return `${name}: запас ${5 * x.level} хитов на долгий отдых`
    case 'favored-enemy':
      return `${name}: ${spellName('hunters-mark')} всегда подготовлено, ${times(col('favored_enemy'))} без ячейки за долгий отдых`
    case 'sneak-attack':
      return `${name}: +${dice(String(r.columns.sneak_attack || '1d6'))} раз в ход`
    case 'arcane-recovery':
      return `${name}: раз в день после короткого отдыха вернуть ячейки суммарно ${Math.ceil(x.level / 2)} круга`
    case 'tinkers-magic':
      return `${name}: заговор ${spellName('mending')}; с инструментами ремонтника создать простой предмет ${times(Math.max(1, x.mods.int))} за долгий отдых`
    default:
      return null
  }
}

// "1к4 + 2", "1к4 − 1", "1к4"
const plusMod = (dieText: string, m: number) => (m > 0 ? `${dieText} + ${m}` : m < 0 ? `${dieText} − ${-m}` : dieText)

const SHIFTING_RU: Record<string, (str: number) => string> = {
  beasthide: () => 'ещё 1к6 временных хитов и +1 к КД',
  longtooth: (str) => `укус бонусным действием, ${plusMod('1к6', str)} колющего`,
  swiftstride: () => 'скорость +10 фт, реакцией отойти на 10 фт без провоцированных атак',
  wildhunt: () => 'преимущество на проверки Мдр, в пределах 30 фт по вам не атакуют с преимуществом'
}

// The species trait line whose numbers follow the level, the proficiency bonus or a modifier, or null.
export function speciesNumberLine(
  speciesId: string,
  x: { level: number; pb: number; con: number; str?: number; option: SpeciesOption | null }
): string | null {
  switch (speciesId) {
    case 'dhampir':
      return `Укус вампира: безоружный удар ${plusMod('1к4', x.con)} колющего; вытягивание или усиление ${times(x.pb)} за долгий отдых`
    case 'kalashtar':
      return `Связь разумов: телепатия ${10 * x.level} фт; действием Магия собеседник может отвечать вам 1 час`
    case 'lupin':
      return `Вой: бонусным действием, существа на выбор в 15 фт — спасбросок Мдр Сл ${8 + x.pb + x.con}, иначе помеха на атаки и спасброски до вашего следующего хода; ${times(x.pb)} за долгий отдых`
    case 'reborn':
      return `Знание прошлой жизни: +1к6 к проваленной проверке характеристики, ${times(x.pb)} за долгий отдых`
    case 'shifter': {
      const benefit = x.option ? SHIFTING_RU[x.option.id]?.(x.str ?? 0) : ''
      return `Перевоплощение${x.option ? ` (${nameOf(x.option)})` : ''}: бонусным действием на 1 минуту, ${2 * x.pb} временных хитов${benefit ? '; ' + benefit : ''}; ${times(x.pb)} за долгий отдых`
    }
    case 'aasimar':
      return `Исцеляющие руки: раз за долгий отдых касанием восстановить ${x.pb}к4 хитов`
    case 'dragonborn': {
      const dt = x.option?.breath_weapon_damage_type
      const n = x.level >= 17 ? 4 : x.level >= 11 ? 3 : x.level >= 5 ? 2 : 1
      return `Оружие дыхания: ${n}к10 ${dt ? damageName(dt) : ''}, Сл ${8 + x.con + x.pb} Лов, конус 15 фт или линия 30 фт; ${times(x.pb)} за долгий отдых`
    }
    case 'dwarf':
      return `Знание камня: чувство вибрации 60 фт на 10 минут, ${times(x.pb)} за долгий отдых`
    case 'goliath':
      return `Великанье происхождение: ${x.option ? nameOf(x.option) : ''}, ${times(x.pb)} за долгий отдых`
    case 'orc':
      return `Прилив адреналина: рывок бонусным действием и ${x.pb} временных ${x.pb >= 5 ? 'хитов' : 'хита'}, ${times(x.pb)} за короткий или долгий отдых`
    default:
      return null
  }
}

const ORDER_EFFECT: Record<string, string> = {
  protector: 'владение воинским оружием и тяжёлыми доспехами',
  thaumaturge: 'ещё один заговор; бонус Мдр (мин. +1) к проверкам Тайной магии и Религии',
  magician: 'ещё один заговор; бонус Мдр (мин. +1) к проверкам Тайной магии и Природы',
  warden: 'владение воинским оружием и средними доспехами'
}

export function classFeatureLines(d: Derived, s: WizardState): string[] {
  const cls = d.cls
  if (!cls) return []
  const lines: string[] = []
  const ctx: NumbersCtx = { cls, level: 1, mods: d.mods }
  for (const f of cls.level_1_features) {
    const name = f.name_ru || f.name
    let text = classFeatureNumbers(f.id, name, ctx) ?? name
    switch (f.id) {
      case 'unarmored-defense':
        text = cls.id === 'monk'
          ? `${name}: КД = 10 + Лов + Мдр без доспехов и щита`
          : `${name}: КД = 10 + Лов + Тел без доспехов, можно со щитом`
        break
      case 'weapon-mastery': {
        const list = s.features.masteries.map((id) => {
          const w = byId.weapon[id]
          return w ? `${nameOf(w)} (${ruName('weapon_masteries', w.mastery).toLowerCase()})` : id
        })
        text = `${name}: ${list.join(', ')}`
        break
      }
      case 'divine-order':
      case 'primal-order': {
        const group = f.id === 'divine-order' ? 'divine-order' : 'primal-order'
        const o = (classOptions[group] || []).find((x) => x.id === s.features.order)
        text = o ? `${name}: ${nameOf(o)} — ${ORDER_EFFECT[o.id] || ''}` : name
        break
      }
      case 'druidic':
        text = `${name}: знаете Друидический; ${spellName('speak-with-animals')} всегда подготовлено`
        break
      case 'fighting-style': {
        const st = s.features.fightingStyle ? byId.feat[s.features.fightingStyle] : undefined
        text = `${name}: ${st ? nameOf(st) : '—'}`
        break
      }
      case 'expertise':
        text = `${name}: ${skillNames(s.skills.expertise)}`
        break
      case 'thieves-cant':
        text = `${name} и ещё один язык: ${s.skills.extraLanguages.map((id) => nameOf(byId.language[id])).join(', ')}`
        break
      case 'innate-sorcery':
        text = `${name}: 2 раза за долгий отдых; на 1 минуту +1 к Сл заклинаний чародея и преимущество на их атаки`
        break
      case 'eldritch-invocations': {
        const opts = classOptions['eldritch-invocation'] || []
        const list = s.features.invocations.map((id) => invocationName(id, nameOf(opts.find((o) => o.id === id))))
        text = `${name}: ${list.join(', ')}`
        break
      }
      case 'ritual-adept':
        text = `${name}: ритуалы из книги заклинаний без подготовки`
        break
    }
    lines.push(text)
  }
  return lines
}

function lineageSpells(d: Derived): string {
  return (d.spOption?.spells || [])
    .map((x) => spellName(x.spell) + (x.character_level > 1 ? ` (с ${x.character_level}-го ур.)` : ''))
    .join(', ')
}

export function speciesTraitLines(d: Derived, s: WizardState): string[] {
  const sp = d.sp
  if (!sp) return []
  const opt = d.spOption ? nameOf(d.spOption) : ''
  const dv = d.darkvision ? `Тёмное зрение ${d.darkvision} фт` : ''
  const ab = s.species.spellAbility ? ` (${abilityName(s.species.spellAbility as Ability)})` : ''
  const num = speciesNumberLine(sp.id, { level: 1, pb: PB, con: d.mods.con, str: d.mods.str, option: d.spOption || null })
  const chosenSkills = s.species.skills.length ? skillNames(s.species.skills) : '—'
  const tool = s.species.tool ? nameOf(byId.item[s.species.tool]) : ''
  const kind = sp.creature_type !== 'humanoid' ? `Тип существа: ${ruName('creature_types', sp.creature_type)}` : ''
  const lines: (string | false | null)[] = (() => {
    switch (sp.id) {
      case 'aasimar':
        return [
          'Небесное сопротивление: некротическая энергия и излучение',
          dv,
          num,
          `Несущий свет: заговор ${spellName('light')} (Харизма)`,
          'Небесное откровение — с 3-го уровня'
        ]
      case 'dragonborn': {
        const dt = d.spOption?.breath_weapon_damage_type
        const dmg = dt ? damageName(dt) : ''
        return [
          `Драконий предок: ${opt} (${dmg})`,
          num,
          `Сопротивление урону: ${dmg}`,
          dv,
          'Драконий полёт — с 5-го уровня'
        ]
      }
      case 'dwarf':
        return [
          dv,
          'Дварфийская устойчивость: сопротивление урону ядом, преимущество против отравления',
          'Дварфийская выдержка: +1 хит за каждый уровень',
          num
        ]
      case 'elf':
        return [
          dv,
          `Эльфийская родословная: ${opt} — ${lineageSpells(d)}${ab}`,
          'Наследие фей: преимущество на спасброски от очарования',
          `Обострённые чувства: ${chosenSkills}`,
          'Транс: долгий отдых за 4 часа медитации'
        ]
      case 'gnome':
        return [
          dv,
          'Гномья хитрость: преимущество на спасброски Инт, Мдр и Хар',
          d.spOption?.id === 'forest-gnome'
            ? `Гномья родословная: ${opt} — заговор ${spellName('minor-illusion')}; ${spellName('speak-with-animals')} ${times(PB)} за долгий отдых без ячейки${ab}`
            : `Гномья родословная: ${opt} — заговоры ${spellName('mending')} и ${spellName('prestidigitation')}, механические безделушки${ab}`
        ]
      case 'goliath':
        return [
          num,
          'Большая форма — с 5-го уровня',
          'Мощное телосложение: преимущество против захвата, грузоподъёмность как у Большого существа'
        ]
      case 'halfling':
        return [
          'Храбрость: преимущество на спасброски от испуга',
          'Проворство: можно проходить через место более крупных существ',
          'Удачливость: 1 на к20 можно перебросить',
          'Естественная скрытность: можно прятаться за более крупным существом'
        ]
      case 'human': {
        const feat = s.species.feat ? byId.feat[s.species.feat] : undefined
        return [
          'Находчивость: героическое вдохновение после каждого долгого отдыха',
          `Умелый: ${chosenSkills}`,
          `Разносторонний: черта «${feat ? nameOf(feat) : '—'}»`
        ]
      }
      case 'orc':
        return [
          num,
          dv,
          'Неумолимая стойкость: раз за долгий отдых остаться с 1 хитом вместо 0'
        ]
      case 'tiefling': {
        const res = d.spOption?.resistances[0]
        return [
          dv,
          `Дьявольское наследие: ${opt} — сопротивление ${res ? damageName(res) : ''}, ${lineageSpells(d)}${ab}`,
          `Иномирное присутствие: заговор ${spellName('thaumaturgy')}`
        ]
      }
      case 'changeling':
        return [
          kind,
          `Инстинкты подменыша: ${chosenSkills}`,
          'Перевёртыш: действием изменить внешность и голос, размер Средний или Маленький; в чужом облике преимущество на проверки Харизмы'
        ]
      case 'dhampir':
        return [
          dv,
          `Паучье лазание: скорость лазания ${d.speed} фт; по стенам и потолкам без рук — с 3-го уровня`,
          `След не-жизни: сопротивление (${damageName('necrotic')})`,
          num
        ]
      case 'hexblood':
        return [
          kind,
          dv,
          'Мистический маркер: бонусным действием раз за долгий отдых; послание до 25 слов или наблюдение через маркер в пределах 10 миль',
          `Ведьмовская магия: ${spellName('disguise-self')} и ${spellName('hex')} всегда подготовлены, каждое раз за долгий отдых без ячейки${ab}`
        ]
      case 'kalashtar':
        return [
          kind,
          'Двойственность разума: преимущество на спасброски Мдр и Хар',
          `Ментальная дисциплина: сопротивление (${damageName('psychic')})`,
          num,
          `Отделённый от снов: «${spellName('dream')}» не действует на вас; после долгого отдыха владение одним навыком до следующего`
        ]
      case 'khoravar':
        return [
          dv,
          'Наследие фей: преимущество на спасброски от очарования',
          `Дар фей: заговор ${spellName('friends')}${ab}; после долгого отдыха можно заменить заговором Волшебника, Друида или Жреца`,
          'Сопротивление летаргии: проваленный спасбросок от бессознательности можно сделать успешным, снова — через 1к4 долгих отдыха',
          `Универсальные умения: ${s.species.skills.length ? chosenSkills : tool || '—'}; после долгого отдыха можно заменить другим навыком или инструментом`
        ]
      case 'lupin':
        return [
          dv,
          'Звериный наскок: безоружные удары наносят рубящий урон; раз в ход при попадании в действии Атака — и урон, и толчок',
          num,
          `Инстинкты оборотня: ${chosenSkills}`
        ]
      case 'reborn':
        return [
          'Избежавший смерти: преимущество на спасброски от смерти',
          'Небренный: без истощения от жажды, голода и удушья; не спит, долгий отдых за 4 часа',
          `Знание прошлой жизни: навык ${chosenSkills}`,
          num,
          `Сверхъестественная устойчивость: сопротивление (${s.species.resistance ? damageName(s.species.resistance) : '—'})`
        ]
      case 'shifter':
        return [
          `Звериные инстинкты: ${chosenSkills}`,
          dv,
          num
        ]
      case 'warforged':
        return [
          kind,
          'Устойчивость конструкта: сопротивление урону ядом, преимущество против отравления',
          'Встроенная защита: +1 к КД, надетый доспех нельзя снять против вашей воли',
          'Отдых часового: не спит, долгий отдых за 6 часов',
          `Специальная сборка: ${chosenSkills}, ${tool || '—'}`,
          'Неустанность: без истощения от жажды, голода и удушья'
        ]
      default:
        return []
    }
  })()
  return lines.filter((l): l is string => Boolean(l))
}

export function featLines(d: Derived, s: WizardState): string[] {
  const lines: string[] = []
  for (const slot of d.featSlots) {
    const f = slot.feat
    const from = slot.slot === 'background' ? 'предыстория' : 'вид'
    const p = slot.picks
    let detail = ''
    switch (f.id) {
      case 'skilled':
        detail = p.picks.map((x) => x.startsWith('skill:') ? nameOf(byId.skill[x.slice(6)]) : nameOf(byId.item[x.slice(5)])).join(', ')
        break
      case 'magic-initiate': {
        const list = slot.fixedList || p.spellList
        detail = [
          list ? 'список: ' + ruName('classes', list) : '',
          p.ability ? abilityName(p.ability) : '',
          [...p.cantrips, ...(p.spell ? [p.spell] : [])].map(spellName).join(', ')
        ].filter(Boolean).join('; ')
        break
      }
      case 'crafter':
        detail = p.picks.map((id) => nameOf(byId.item[id])).join(', ') + '; скидка 20% на немагические предметы'
        break
      case 'musician':
        detail = p.picks.map((id) => nameOf(byId.item[id])).join(', ')
        break
      case 'alert':
        detail = `+${PB} к инициативе, можно меняться инициативой с союзником`
        break
      case 'tough':
        detail = '+2 хита за каждый уровень'
        break
      case 'lucky':
        detail = `${points(PB)} удачи на долгий отдых`
        break
      case 'savage-attacker':
        detail = 'раз в ход бросать урон оружия дважды и выбирать'
        break
      case 'healer':
        detail = 'лечение набором целителя, переброс единиц при лечении'
        break
      case 'tavern-brawler':
        detail = 'безоружный удар 1к4 + Сил, владение импровизированным оружием'
        break
    }
    lines.push(`«${nameOf(f)}» (${from})` + (detail ? ': ' + detail : ''))
  }
  if (s.features.fightingStyle) {
    lines.push(`«${nameOf(byId.feat[s.features.fightingStyle])}» (боевой стиль)`)
  }
  return lines
}

export function abilityLabel(a: Ability): string {
  return abilityShort(a)
}
