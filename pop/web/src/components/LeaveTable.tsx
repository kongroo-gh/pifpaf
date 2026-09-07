// 対局の途中で卓を降りる。単機版とオンライン版で同じものを使う。
//
// **必ず確認を挟む。** 盤面の隅の小さな印なので、狙わずに触れることがある。
// 一度押しただけで賭け金や席が消えるのは割に合わない。
//
// **出すのは「ここ以外に出口が無い」ときだけ。** 待機中には SAIR が、決着後には
// VOLTAR À MESA が、それぞれパネルの中にある。そこへ重ねて隅にも置くと、
// ルールブックの閉じるが右上と左下で重複していたのと同じことになる。

import { useT, Kicker, Gloss, Rich } from "../i18n";
import { sfx } from "../audio";

/** 盤面の右上、?と歯車の右に置く印。 */
export function LeaveButton({ onClick }: { onClick: () => void }) {
  const t = useT();
  return (
    <button
      type="button"
      className="iconButton"
      onClick={() => {
        sfx.click();
        onClick();
      }}
      aria-label={t.leave.open}
      title={t.leave.open}
    >
      {/* 枠から右へ出ていく矢印。×だと「この窓を閉じる」に見えてしまう */}
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M13.5 4.5H6.5A1.5 1.5 0 0 0 5 6v12a1.5 1.5 0 0 0 1.5 1.5h7"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <path
          d="M12.5 12H20m0 0-3-3m3 3-3 3"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

export interface LeaveConfirmProps {
  /** 降りると何を失うか。単機版は賭け金、オンラインは席 */
  warning: string;
  onLeave: () => void;
  onStay: () => void;
}

/**
 * 降りるかを訊く画面。
 * 続ける側（FICAR）を左に置く。取り返しがつかないほうを指の近くに置かない。
 */
export function LeaveConfirm({ warning, onLeave, onStay }: LeaveConfirmProps) {
  const t = useT();
  return (
    <div
      className="panel panel--verdict"
      role="dialog"
      aria-modal="true"
      aria-label={t.leave.title}
    >
      <div className="panel__box">
        <Kicker flavor="DEIXAR A MESA" gloss={t.leave.title} className="panel__kicker" />
        <p className="panel__note">
          <Rich text={warning} />
        </p>
        <div className="panel__actions">
          <button className="btn btn--keep" onClick={onStay}>
            FICAR<Gloss flavor="FICAR" text={t.leave.cancel} />
          </button>
          <button className="btn btn--reject" onClick={onLeave}>
            SAIR<Gloss flavor="SAIR" text={t.leave.confirm} />
          </button>
        </div>
      </div>
    </div>
  );
}
