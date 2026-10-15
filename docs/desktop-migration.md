# デスクトップ移行の実装報告

## 成果物

- Windows x64 NSISインストーラー: `release/TsuzuriVN-Setup-1.0.0.exe`
- インストール不要の実行フォルダ: `release/win-unpacked/`（フォルダ全体が必要）
- 最新インストーラーのハッシュは`Get-FileHash release/TsuzuriVN-Setup-1.0.0.exe -Algorithm SHA256`で確認できる。
- インストーラーは未署名。生成物とキャッシュはGit対象外。

## 保存方式・設計変更

IndexedDBの保存実装を、Main Processの`ProjectStore`へ置換した。Rendererは限定IPC経由で作品・設定・下書きを保存する。Main/PreloadはTypeScriptで実装し、Preloadのみsandbox対応のCommonJSへコンパイルする。contextIsolationとsandboxは有効、nodeIntegrationは無効。

既定の保存先はインストール先フォルダ内の`UserData`（更新後の仕様）。テーマと保存先は上部の歯車から開く設定画面で変更できる。プロジェクトと素材は共通の保存先へまとめる。旧Documents保存先と既存の個別保存先は参照を維持する。作品ごとに独立したフォルダを作り、`scenario.json`に作品ID・時刻・従来のシナリオモデル・素材一覧を保存する。素材はSHA-256で識別し、`assets/<hash>.<ext>`へバイナリで置く。同じ作品内の同じ内容は1ファイルになる。相対パスと素材IDなので作品フォルダを移動できる。

原稿と話者割り当ては`drafts/bulk.json`、アプリの保存先・テーマ・最近使った作品はuserDataの`settings.json`へ保存する。作品を閉じた後も下書きはその作品に残る。

素材の取り込み・パス指定・ファイル読み書き・ファイル書き出しはMainで実行する。通常の素材取り込みはMainでハッシュを計算してファイルをコピーし、Rendererに大きな素材バイト列を渡さない。JSON/ZIPの互換処理だけは既存の処理を再利用し、必要なバイナリを一時的にIPC経由で転送する。

表示・再生用の`tsuzuri-media://<project-id>/<asset-id>`は、開いた作品の登録済み素材だけを解決する。パス・形式・容量を検証し、作品外へ出るシンボリックリンクを拒否する。素材のSHA-256は初回アクセス時にストリームで検証し、ファイルの更新時刻・サイズが変われば再検証する。全作品の素材を常時Blobとして読み込まない。

Rendererの保存要求とMainの作品ごとの書き込みを直列化した。JSONは一時ファイルへの書き込み、fsync、再読み込み・検証、置換の順で保存し、直前の正常なJSONを`.bak`へ残す。終了前は処理中の取り込みと本文・下書きの保存完了を待つ。保存できないときだけ終了確認を出す。

ViteはRendererのビルド専用とし、実行時は`tsuzuri-app://`から同梱ファイルを読む。旧HTTPフルパス読み込みエンドポイントは削除した。`start.bat`はElectronのビルド・起動へ変更し、ポート番号は使用しない。

未使用素材の自動削除は行わない。以前の正常なJSONやバックアップから参照する素材を失わせないための変更であり、ディスク容量とのトレードオフになる。手動バックアップは素材・下書きを含む独立した作品フォルダを作る。削除は`.trash`への移動とする。

## 変更ファイル一覧

### 新規

- `electron/main.ts`: 起動、専用プロトコル、限定IPC、ダイアログ、終了時保存待ち
- `electron/preload.cts`: contextBridge、選択済み入力ファイルの制限、保存完了応答
- `electron/project-store.ts`: ファイル保存、直列化、素材取り込み・重複排除、複製、バックアップ、復旧
- `electron/validation.ts`: フォルダ形式、素材・シーンID・下書きの検証
- `electron/tsconfig.json`: Main/Preloadのビルド
- `shared/desktop.ts`: IPC APIの型
- `src/desktop.ts`: RendererのIPC接続、ファイル操作、終了前フラッシュ登録
- `src/ProjectActions.tsx`: 手動保存・再試行、保存先を開く、バックアップ、復旧UI
- `src/SettingsDialog.tsx`: ヘッダーの歯車・テーマ・保存先設定
- `tests/desktop-settings.mjs`: 設定画面と既定／個別保存先の検証
- `scripts/launch-desktop.mjs`: Viteサーバーを起動しないElectronランチャー
- `build/icon.ico`: アプリ・インストーラーのアイコン
- `build/installer.nsh`: 更新・アンインストールでUserDataと作品フォルダを削除しないフック
- `tests/installer-userdata.mjs`: NSIS削除フックの独立した実行テスト
- `tests/filesystem.test.ts`: ファイル保存の正常系・異常系
- `tests/desktop.mjs`: Electron上の編集・保存・再生・終了・異常終了・再起動
- `tests/desktop-compat.mjs`: 旧JSON/ZIP・複製・移動・保存先変更
- `tests/desktop-packaged.mjs`: 配布用exeの起動・保存・再生・分離設定
- `docs/desktop-migration.md`: 本報告

### 更新

- `src/storage.ts`: IndexedDBを廃止し、フォルダ保存APIへ置換
- `src/assets.ts`: ネイティブ素材URLと安定した素材IDの変換
- `src/model.ts`: ネイティブ素材取り込み、既存シーンIDの保持と重複拒否
- `src/App.tsx`: 作品フォルダを開く・既定保存先変更・ネイティブ複製
- `src/Library.tsx`: フォルダ管理UI・保存先表示・削除説明
- `src/Editor.tsx`: ファイル保存状態、再試行、終了前保存、処理中の取り込み待ち、ネイティブ書き出し
- `src/BulkCreator.tsx`: 下書きのファイル保存・終了前保存・保存失敗後の再試行
- `src/VoiceEditor.tsx`, `src/BgmEditor.tsx`: 音声のドラッグ＆ドロップ、パス入力の説明
- `src/localAudio.ts`: HTTP経由からMainの音声取り込みへ置換
- `src/TextCopyButton.tsx`: ネイティブクリップボード書き込み
- `src/main.tsx`, `src/ThemeSwitch.tsx`: userData設定によるテーマ復元・保存
- `src/style.css`: ファイル管理操作のスタイル
- `package.json`, `package-lock.json`: Electron・Electron Builder、ビルド・配布設定
- `vite.config.ts`: 同梱ファイルの相対パス対応、旧サーバープラグインの除去
- `scripts/start.mjs`, `start.bat`: デスクトップ起動への切り替え
- `.gitignore`: 配布物・キャッシュ・テストデータの除外、Electronテストの追跡
- `README.md`: 起動、保存、移行、復旧、検証、制限を更新

### 削除

- `server/localAudio.ts`: デスクトップ版では不要なローカルHTTPファイル読み込み

既存のプレイヤー、背景クロスフェード、文字送り、ページ分割、フィルタ、話者色などのUIは再利用した。作業開始前から存在する他の差分や実作品には手を加えていない。

## 既存データの移行

旧ブラウザ版を従来のブラウザ・URL・ポートで開き、作品ごとにZIPまたは素材埋め込みJSONを出力する。新アプリでそのファイルを読み込むと、新しい作品IDとフォルダへ変換する。元のファイル、既存の作品、旧ブラウザのIndexedDBを上書き・削除しない。

ZIPは従来の`tsuzuri-project` version 2、JSONの互換書き出しは従来のversion 1を維持している。既存シーンIDは保持し、同じ作品内でIDが重複する場合はエラーにする。フォルダ形式の`scenario.json`は「作品フォルダを開く」で利用する。

## 検証結果

- `npm run build`: Renderer、Main、Preloadの型チェック・ビルド成功
- `npm test`: 5ファイル・31テスト成功
- `node tests/desktop.mjs`: 実際のElectronで新規作成、日本語編集、下書き、Main経由の音声取り込み、ネイティブクリップボード、ボイス/BGM同時再生と継続・停止、手動保存、バックアップ、終了直前のフラッシュ、強制終了後の正常データ読み込み、再起動、シーンID保持を確認
- `node tests/desktop-compat.mjs`: 旧JSONからの変換、素材重複排除、元作品保持、vn.zip往復、ネイティブ複製、作品フォルダ移動、保存先変更を確認
- `node tests/desktop-packaged.mjs`: `release/win-unpacked/TsuzuriVN.exe`からViteなしで起動し、app.asar内の画面表示、新規作成・保存・再生、userData設定、contextIsolation/nodeIntegration/sandboxの実値を確認
- ファイル保存テストでは、置換前のエラー注入、直列保存、壊れたscenario.jsonからの.bak復旧、未完了.tmpの無視、素材欠損、パス・ID検証、独立バックアップ、下書き保存・クリア、移動とソフト削除を確認
- `node tests/desktop-settings.mjs`: 歯車設定、UserData既定、保存先・テーマ変更と復元、失敗時の維持を確認
- `node tests/installer-userdata.mjs`: 実際のNSISマクロを独立フォルダで実行し、アプリ本体の削除後もUserDataと独自作品フォルダが残ることを確認（実インストールやレジストリ変更はしない）
- `npm run dist:win`: Windows x64 NSISインストーラーの生成成功
- `npm audit --omit=dev`: 0件

ElectronのGUIテストは、実行環境のWindowsサンドボックスACL制限により通常のGUI実行権限で行った。アプリ自体のsandbox、contextIsolation、webSecurityは無効化していない。テストデータは`.desktop-test-*`と専用userDataへ隔離した。

## 残課題・制限

- コード署名証明書は含まれていないため未署名。自動更新の配信も対象外。
- 実際のWindowsへのインストール・アンインストールは未実施。生成した配布用exeの実動確認とインストーラー生成までを確認した。
- 完全な依存監査ではElectron Builderの推移的なビルド用依存にmoderate 8件が残る。配布アプリに含まれる本番依存の監査は0件。強制的なメジャー差し替えは行っていない。
- 旧JSON/ZIPの互換インポート・エクスポートは、その処理中にデータ全体をメモリ上に扱う。通常のファイル保存・読み込み・再生とは分けている。
- 未使用素材の自動回収、同一作品の複数プロセス同時編集、クラウド同期の競合解決は含めていない。
- 強制終了では未保存の直近変更までは保証しない。最後に正常に保存したscenario.jsonまたは.bakを復元する設計であり、ドライブ故障や停電への完全な耐性は保証しない。
