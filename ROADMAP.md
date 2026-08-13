# Roadmap

本路线图用于记录 `threejs-miniprogram-adapter` 从实验适配层走向可信开源项目的迭代顺序。日期和范围会随真实使用反馈调整，但不会以自动化测试代替微信开发者工具或真机证据。

## 维护原则

- 正确性、安全性和资源生命周期优先于新增 addon 数量。
- 公共运行时导出、类型声明、测试、示例和 README 必须保持一致。
- 每项宿主相关能力都要区分“自动化已证明”与“仍需真机确认”。
- 不保留没有实际行为的兼容 API；无法可靠实现时明确标记限制或弃用。
- npm 发布前必须完成开发者工具、Android 和 iOS 验收。

## 当前基线（2026-08）

- `npm run check` 覆盖语法、109 个 Node 测试、TypeScript consumer、publint 和打包检查。
- CI 覆盖 three.js r160、r174、r183、r185。
- WebGL2、普通 GLTF/GLB、OrbitControls 和主线程 DRACO 均处于实验支持阶段。
- 尚未完成微信开发者工具、Android、iOS 的完整验收，也尚未发布到 npm registry。

## 第一阶段：核心运行时稳定性

目标：让最常见的渲染、资源加载和页面生命周期路径具备可重复的自动化证据。

- [x] 补齐 `globalThis`、`window`、`self` 的 polyfill 一致性，覆盖内嵌纹理 GLB。
- [x] 让 `inspectWebGL()` 正确报告 renderer 已创建的 WebGL1 或 WebGL2 上下文。
- [x] 恢复 WebGL 上下文时保留初次创建使用的 context attributes。
- [ ] 修复触摸手势的双击、多指移动和平移能力；未实现的选项不得继续宣称支持。
- [ ] 统一四个示例的尺寸、像素比、暂停/恢复和销毁行为。
- [ ] 为远程 GLB、本地 GLB、内嵌纹理 GLB 和上下文恢复增加集成测试。

## 第二阶段：平台 API 与兼容面收敛

目标：减少对停止维护 API 和空壳兼容层的依赖，明确稳定的公共接口。

- [ ] 优先使用 `wx.getWindowInfo()`、`wx.getDeviceInfo()`、`wx.getAppBaseInfo()`，保留旧基础库回退。
- [ ] 审核 Fetch、XHR、Blob、URL、Image 的取消、错误和临时文件生命周期。
- [ ] 审核多页面、多 Canvas 下的 document 与图片工厂归属。
- [ ] 清理或弃用无实际行为的 `enhance*Loader()`；保留的插件必须有示例和测试。
- [ ] 为 Audio、Video 等占位实现确定保留、收缩或弃用策略。
- [ ] 在 CI 中实际覆盖声明的最低 Node 版本，并持续记录核心模块覆盖率。

## 第三阶段：微信宿主验收

目标：把实验能力转换为有设备、版本和证据记录的兼容结论。

- [ ] 微信开发者工具：basic、controls、loaders、draco 四页全部通过。
- [ ] Android：基础渲染、OrbitControls、远程/本地/内嵌纹理 GLB、DRACO、销毁重进。
- [ ] iOS：覆盖 Android 清单，并额外验证切后台、锁屏与 `recoverContext()`。
- [ ] 记录 three.js 版本、基础库版本、开发者工具版本、系统、机型、结果和截图/录屏。
- [ ] 根据证据更新 README 能力表；失败项建立可复现 Issue。

## 第四阶段：社区与首发准备

目标：让外部用户能够判断项目状态、贡献修复并安全升级。

- [ ] 同步 GitHub 描述、DRACO Issue 和公开能力说明。
- [ ] 补充第三方 Draco 许可证/notice、PR 模板、变更记录和发布说明。
- [ ] 根据首发稳定性决定正式版本号，不以当前 `1.0.0` 自动代表稳定承诺。
- [ ] 完成发布前人工清单后运行 `npm run check` 与 `npm pack --dry-run`。
- [ ] 仅在维护者明确授权后发布 npm，并从干净 consumer 工程复验安装、类型和运行入口。

## 完成定义

一项路线图任务只有在以下条件同时满足时才算完成：

1. 有最小复现或明确需求；
2. 自动化测试证明实现行为且 `npm run check` 全绿；
3. 运行时导出、类型、示例和文档按影响同步；
4. 宿主相关改动写明仍需验证的平台；
5. 变更已通过独立分支和 PR 保存到远端。
