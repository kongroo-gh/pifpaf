// 描画で例外が出たときの受け皿。
//
// **React は、どこか1か所で投げると木ごと外す。** 受け皿が無いと画面が
// 真っ黒になり、遊んでいる側からは「進まない」としか見えない。実際に起きた:
// 画面（Pages）だけ先に更新され、卓（Render）が古いままの時間帯に、
// サーバーがまだ送っていない項目を読んで落ちていた。
//
// **原因を直すのが本筋で、ここはその手前の安全網。** 直せていない何かが
// 残っていても、せめて「壊れた」と分かる形で止まり、やり直せるようにする。
//
// 文言は辞書を通さない。i18n の側が壊れている可能性もあるので、
// ここだけは何にも依存させない。

import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  message: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { message: null };

  static getDerivedStateFromError(error: unknown): State {
    return { message: error instanceof Error ? error.message : String(error) };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    // 開発中は元の場所が分かるように残す。本番でも console には出しておく
    console.error("描画で落ちた", error, info.componentStack);
  }

  override render(): ReactNode {
    const { message } = this.state;
    if (message === null) return this.props.children;

    return (
      <div className="app app--intro">
        <div className="intro">
          <p className="intro__kicker">A MESA QUEBROU</p>
          <h1 className="intro__title">PIF PAF</h1>
          <div className="intro__rule" />
          <p className="intro__body">
            うまく描けなかった。読み込み直すと元に戻る。
            <br />
            Something broke. Reload to start over.
          </p>
          <p className="panel__dim">{message}</p>
          <div className="intro__actions">
            <button className="btn btn--rules" onClick={() => window.location.reload()}>
              RECARREGAR<small>読み込み直す / Reload</small>
            </button>
          </div>
        </div>
      </div>
    );
  }
}
