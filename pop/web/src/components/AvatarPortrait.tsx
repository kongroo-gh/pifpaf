import type { AvatarId } from "@pifpaf/protocol";
import { avatarForSeat } from "../game/avatars";

export function AvatarPortrait({
  avatarId,
  seat = 0,
  className = "",
}: {
  avatarId?: AvatarId;
  seat?: number;
  className?: string;
}) {
  const avatar = avatarForSeat(avatarId, seat);
  const isFemale = avatar.gender === "female";
  const hasLongHair = avatar.hair === "bob" || avatar.hair === "long" || avatar.hair === "curl";

  return (
    <svg
      className={`avatarPortrait seat__person ${className}`.trim()}
      viewBox="0 0 100 100"
      data-avatar-id={avatar.id}
      data-person={avatar.id}
      data-character={avatar.name}
      aria-hidden="true"
      focusable="false"
    >
      <ellipse cx="50" cy="92" rx="43" ry="6" fill="#080e0b" opacity=".42" />
      <path d="M13 89 18 66Q22 56 39 55h22q17 2 21 13l6 21Z" fill={avatar.jacket} stroke="#172322" strokeWidth="2" />
      <path d="m39 55 11 26 11-26-11 5Z" fill="#e9deca" />
      <path d="m48 64-3 13 5 10 5-10-3-13Z" fill={avatar.tie} />
      <path d="m38 56-8 9 10 4-4 8 14 12m12-33 8 9-10 4 4 8-14 12" fill="none" stroke="#bdc3ae" strokeOpacity=".4" strokeWidth="2" />

      <g className="seat__face">
        {hasLongHair && <path d="M27 38Q23 7 50 5t24 33v25H27Z" fill={avatar.hairColor} />}
        {avatar.hair === "bun" && <circle cx="50" cy="8" r="9" fill={avatar.hairColor} />}
        <path d="M43 44h14v15q-7 7-14 0Z" fill={avatar.skin} />
        <ellipse cx="32" cy="33" rx="4" ry="7" fill={avatar.skin} />
        <ellipse cx="68" cy="33" rx="4" ry="7" fill={avatar.skin} />
        <path d="M32 24Q32 8 50 8t18 16l-3 18Q61 53 50 54 39 53 35 42Z" fill={avatar.skin} />

        {avatar.hair === "crop" || avatar.hair === "buzz" ? (
          <path d="M31 29Q26 9 47 6q27-2 23 27l-6-12q-15 5-27-3l-3 12Z" fill={avatar.hairColor} />
        ) : avatar.hair === "wave" ? (
          <path d="M29 29Q25 8 47 6q25-3 25 24-9-8-17-5-13 4-13-3-13 4Z" fill={avatar.hairColor} />
        ) : avatar.hair === "part" ? (
          <path d="M29 30Q28 8 51 7q22 1 20 25-14-7-20-19-5 11-22 17Z" fill={avatar.hairColor} />
        ) : (
          <path d="M28 33Q27 8 50 6q24 2 22 27-8-11-21-13-14 1-23 13Z" fill={avatar.hairColor} />
        )}

        <path d="m39 31 6-1m11 0 6 1" stroke="#473229" strokeWidth="2" strokeLinecap="round" />
        <g className="seat__eyes" fill="#262626"><ellipse cx="42" cy="34" rx="1.7" ry="2" /><ellipse cx="59" cy="34" rx="1.7" ry="2" /></g>
        <path d="m50 34-2 6 4 1m-9 5q7 4 14-1" fill="none" stroke="#805442" strokeWidth="1.5" strokeLinecap="round" />

        {avatar.id === 0 && <path d="M36 32h11v8H36Zm18 0h11v8H54Zm-7 3h7" fill="none" stroke="#ded2b0" strokeWidth="1.6" />}
        {avatar.id === 1 && <path d="M41 44q5-7 10-2 5-5 10 2-6 3-10 0-5 3-10 0" fill={avatar.hairColor} />}
        {avatar.id === 2 && <path d="m61 36 5 5" stroke="#8b4f46" strokeWidth="1.4" />}
        {avatar.id === 3 && <path d="M34 28q16-8 32 0" fill="none" stroke="#dad4c8" strokeWidth="2" opacity=".55" />}
        {isFemale && <><circle cx="31" cy="42" r="1.8" fill={avatar.accent} /><circle cx="69" cy="42" r="1.8" fill={avatar.accent} /></>}
      </g>

      <g className="seat__hands" fill={avatar.skin} stroke="#815541" strokeWidth="1">
        <path d="m17 80 19 3q10-7 16-2l-8 5q7-2 7 2-3 5-14 3l-21-2Z" />
        <path d="m83 80-16 3q-8-8-14-3l6 6q-7-2-7 2 3 5 14 3l18-2Z" />
      </g>
    </svg>
  );
}
