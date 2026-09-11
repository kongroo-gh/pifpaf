import type { AvatarId } from "@pifpaf/protocol";
import { avatarForSeat } from "../game/avatars";

export function AvatarPortrait({ avatarId, seat = 0 }: { avatarId?: AvatarId; seat?: number }) {
  const avatar = avatarForSeat(avatarId, seat);
  const longHair = avatar.hair === "bob" || avatar.hair === "long" || avatar.hair === "curl";
  const bun = avatar.hair === "bun";
  const closeCrop = avatar.hair === "crop" || avatar.hair === "buzz";

  return (
    <svg className="avatarPortrait" viewBox="0 0 64 64" data-avatar-id={avatar.id} aria-hidden="true">
      <circle cx="32" cy="32" r="30" fill={avatar.accent} opacity="0.22" />
      <path d="M8 62c2-14 10-21 24-21s22 7 24 21" fill={avatar.accent} />
      {longHair && <path d="M16 29c0-14 7-22 16-22s16 8 16 22v21H16z" fill="#171311" />}
      {bun && <circle cx="32" cy="8" r="8" fill="#211815" />}
      <path d="M22 24h20v14c0 8-4 13-10 13s-10-5-10-13z" fill={avatar.skin} />
      {closeCrop ? (
        <path d="M21 27c0-12 5-18 11-18 8 0 12 6 12 18-7-5-15-6-23 0z" fill="#201815" />
      ) : avatar.hair === "part" ? (
        <path d="M19 27C20 13 27 8 34 9c7 1 11 7 11 18-8-5-13-8-14-14-2 6-6 10-12 14z" fill="#241a16" />
      ) : avatar.hair === "wave" ? (
        <path d="M18 27c1-12 7-19 15-19 9 0 14 7 14 19-4-4-8-5-12-4-6 2-11 0-17 4z" fill="#251b17" />
      ) : (
        <path d="M17 31C17 15 24 7 33 7c10 0 15 9 14 24-5-8-10-12-15-12-6 0-10 4-15 12z" fill="#251916" />
      )}
      <circle cx="28" cy="33" r="1.2" fill="#241714" />
      <circle cx="37" cy="33" r="1.2" fill="#241714" />
      <path d="M29 40c2 1.5 4 1.5 6 0" fill="none" stroke="#633b35" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M20 56h24" stroke="rgba(255,255,255,.26)" strokeWidth="2" />
    </svg>
  );
}
