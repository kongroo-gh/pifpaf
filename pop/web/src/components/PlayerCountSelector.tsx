import { PLAYER_COUNTS, type PlayerCount } from "@pifpaf/engine";
import { useT } from "../i18n";
export function PlayerCountSelector({ value, onChange }: { value: PlayerCount; onChange: (n: PlayerCount) => void }) {
  const t = useT();
  return <fieldset className="playerCount" data-player-count>
    <legend>{t.players.label}</legend>
    <div>{PLAYER_COUNTS.map(n => <button key={n} type="button" aria-label={t.players.count(n)} aria-pressed={value === n} onClick={() => onChange(n)}>{n}</button>)}</div>
  </fieldset>;
}
