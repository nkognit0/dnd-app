// Short Russian summaries for the sheet's text blocks: level 1 class features,
// species traits and feats, with the character's own numbers filled in.
import { Ability, abilityName, abilityShort, byId, classOptions, nameOf, ruName } from '../data'
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

const INVOCATIONS_RU: Record<string, string> = {
  'armor-of-shadows': 'Доспех теней',
  'eldritch-mind': 'Таинственный разум',
  'pact-of-the-blade': 'Договор клинка',
  'pact-of-the-chain': 'Договор цепи',
  'pact-of-the-tome': 'Договор гримуара'
}
export const invocationName = (id: string, fallback: string) => INVOCATIONS_RU[id] || fallback

const ORDER_EFFECT: Record<string, string> = {
  protector: 'владение воинским оружием и тяжёлыми доспехами',
  thaumaturge: 'ещё один заговор; бонус Мдр (мин. +1) к проверкам Тайной магии и Религии',
  magician: 'ещё один заговор; бонус Мдр (мин. +1) к проверкам Тайной магии и Природы',
  warden: 'владение воинским оружием и средними доспехами'
}

export function classFeatureLines(d: Derived, s: WizardState): string[] {
  const cls = d.cls
  if (!cls) return []
  const l1 = cls.levels[0]
  const col = (k: string) => Number(l1.columns[k] ?? 0)
  const lines: string[] = []
  for (const f of cls.level_1_features) {
    const name = f.name_ru || f.name
    let text = name
    switch (f.id) {
      case 'rage':
        text = `${name}: ${times(col('rages'))} за долгий отдых, +${col('rage_damage')} к урону атаками Силы, сопротивление дробящему, колющему и рубящему урону`
        break
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
      case 'bardic-inspiration':
        text = `${name}: к6, ${times(Math.max(1, d.mods.cha))} за долгий отдых`
        break
      case 'spellcasting':
      case 'pact-magic': {
        const parts: string[] = []
        if (l1.cantrips) parts.push('заговоров ' + l1.cantrips)
        if (l1.prepared_spells) parts.push('подготовленных заклинаний ' + l1.prepared_spells)
        if (l1.pact_slots) parts.push('ячеек договора ' + l1.pact_slots.count + ' (1 круг, восстанавливаются после короткого отдыха)')
        else if (l1.spell_slots) parts.push('ячеек 1 круга ' + l1.spell_slots[0])
        if (cls.id === 'wizard') parts.push('в книге заклинаний 6')
        const ability = cls.spellcasting ? abilityName(cls.spellcasting.ability) : ''
        text = `${name} (${ability}): ${parts.join(', ')}`
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
      case 'second-wind':
        text = `${name}: ${times(col('second_wind'))}; бонусным действием восстановить 1к10 + 1 хит`
        break
      case 'martial-arts':
        text = `${name}: кость ${dice(String(l1.columns.martial_arts || 'd6'))}, безоружный удар бонусным действием, Лов вместо Сил для монашеского оружия`
        break
      case 'lay-on-hands':
        text = `${name}: запас 5 хитов на долгий отдых`
        break
      case 'favored-enemy':
        text = `${name}: ${spellName('hunters-mark')} всегда подготовлено, ${times(col('favored_enemy'))} без ячейки за долгий отдых`
        break
      case 'expertise':
        text = `${name}: ${skillNames(s.skills.expertise)}`
        break
      case 'sneak-attack':
        text = `${name}: +${dice(String(l1.columns.sneak_attack || '1d6'))} раз в ход`
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
      case 'arcane-recovery':
        text = `${name}: раз в день после короткого отдыха вернуть ячейки суммарно 1 круга`
        break
      case 'ritual-adept':
        text = `${name}: ритуалы из книги заклинаний без подготовки`
        break
      case 'tinkers-magic':
        text = `${name}: заговор ${spellName('mending')}; с инструментами ремонтника создать простой предмет ${times(Math.max(1, d.mods.int))} за долгий отдых`
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
  const lines: (string | false)[] = (() => {
    switch (sp.id) {
      case 'aasimar':
        return [
          'Небесное сопротивление: некротическая энергия и излучение',
          dv,
          `Исцеляющие руки: раз за долгий отдых касанием восстановить ${PB}к4 хитов`,
          `Несущий свет: заговор ${spellName('light')} (Харизма)`,
          'Небесное откровение — с 3-го уровня'
        ]
      case 'dragonborn': {
        const dt = d.spOption?.breath_weapon_damage_type
        const dmg = dt ? damageName(dt) : ''
        return [
          `Драконий предок: ${opt} (${dmg})`,
          `Оружие дыхания: 1к10 ${dmg}, Сл ${8 + d.mods.con + PB} Лов, конус 15 фт или линия 30 фт; ${times(PB)} за долгий отдых`,
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
          `Знание камня: чувство вибрации 60 фт на 10 минут, ${times(PB)} за долгий отдых`
        ]
      case 'elf':
        return [
          dv,
          `Эльфийская родословная: ${opt} — ${lineageSpells(d)}${ab}`,
          'Наследие фей: преимущество на спасброски от очарования',
          `Обострённые чувства: ${s.species.skill ? skillNames([s.species.skill]) : '—'}`,
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
          `Великанье происхождение: ${opt}, ${times(PB)} за долгий отдых`,
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
          `Умелый: ${s.species.skill ? skillNames([s.species.skill]) : '—'}`,
          `Разносторонний: черта «${feat ? nameOf(feat) : '—'}»`
        ]
      }
      case 'orc':
        return [
          `Прилив адреналина: рывок бонусным действием и ${PB} временных хита, ${times(PB)} за короткий или долгий отдых`,
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
        detail = `${PB} очка удачи на долгий отдых`
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
