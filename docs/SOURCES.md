# 开源来源与内容依据

| 项目 | 用途 | 上游许可证 |
| --- | --- | --- |
| [React](https://github.com/facebook/react) / [Vite](https://github.com/vitejs/vite) | 组件和构建 | MIT |
| [React Router](https://github.com/remix-run/react-router) | 页面与深链接 | MIT |
| [Radix Primitives](https://github.com/radix-ui/primitives) | 对话框、筛选等无障碍交互 | MIT |
| [shadcn/ui](https://github.com/shadcn-ui/ui) | 可组合组件的交互与组织参照 | MIT |
| [TanStack Table](https://github.com/TanStack/table) | 后台表格 | MIT |
| [Noto Serif SC](https://github.com/notofonts/noto-cjk/tree/main/Serif) | 中文题名与摘录。随前端分发标题用字的 WOFF 子集 | [SIL Open Font License 1.1](https://github.com/notofonts/noto-cjk/blob/main/Serif/LICENSE)，站内副本 `/fonts/OFL-NotoSerifSC.txt` |
| [Motion](https://github.com/motiondivision/motion) / [Lucide](https://github.com/lucide-icons/lucide) | 过渡与图标 | MIT / ISC（含原始 Feather 图标 MIT） |
| [Express](https://github.com/expressjs/express) / [node-postgres](https://github.com/brianc/node-postgres) | 路由、数据库驱动 | MIT |
| [Express compression](https://github.com/expressjs/compression) | 静态页面与资源协商压缩 | MIT |
| [Zod](https://github.com/colinhacks/zod) / [Cheerio](https://github.com/cheeriojs/cheerio) | 验证和官方页面解析 | MIT |
| [Playwright](https://github.com/microsoft/playwright) / [axe-core](https://github.com/dequelabs/axe-core) | 自动化功能与可访问性检查 | Apache-2.0 / MPL-2.0 |

实际安装版本见 npm 锁文件。[Shadcn Admin](https://github.com/satnaing/shadcn-admin) 和 [Datasette](https://github.com/simonw/datasette) 用于导航、筛选及出处回查交互的研究。本项目保留旧仓基线和公开来源记录，采用自编摘要、专题和界面。公开内容证据见 [来源核验](SEED-AUDIT.md)。

- [SheetJS Community Edition](https://docs.sheetjs.com/docs/getting-started/installation/nodejs/)（Apache-2.0），沿用旧项目的官方 0.20.3 版本，通过按需加载解析 Excel 和 CSV。

此前刊物版首页的大标题、细栏线和目录密度参考 Claude Directory 的刊物样板。矿纹图版根据用户提供的 Render 待机截图重新绘制，采用固定网格内局部转动的构图。该版滑块和环图反馈延续本项目旧 Vue 版的交互。动作分镜参考了模块连接与胶囊滑块的公开示例。[Newsprint Editorial Press](https://github.com/pulkitxm/claude-directory/tree/main/ui-design/newsprint-editorial-press) · [Claude Motion Playbook](https://github.com/PHY041/claude-motion-playbook/blob/main/docs/techniques.md) · [Video Shotcraft](https://github.com/Vincentwei1021/video-shotcraft/blob/main/gallery/index.html)

地质纸偶剧场版的底景、矿样、数据矿脉、时间轨和矿粒点阵均由本项目以 SVG、HTML 与 CSS 绘制。Warp Checks 提供了持续流动的视觉参考。在实际画面上比较过整片弯折和层内推移后，选用了浅斜的稳定地层，以沉积纹和透镜状夹层的生长表现时间。[Warp Checks 示例](https://claude-directory.pulkitxm.com/shaders/warp-checks-background-lab/)

按钮压纸与硬投影参考 [Handcraft Paper UI](https://claude-directory.pulkitxm.com/ui-design/handcraft-paper-ui/)。聚光转向与线条折成下一页边框的动作参考 [Light Play Moves](https://vincentwei1021.github.io/video-shotcraft/#light-play-moves) 与 [Line Carry Transition](https://vincentwei1021.github.io/video-shotcraft/#line-carry-transition)。

矿样顶面的叶脉式显影参考了逐条路径安排描边长度、起始时间的做法。这里用归一化 SVG 路径和 CSS 控制每根等高纹及分枝的显现与退去。[Vivus 逐线计时源码](https://github.com/maxwellito/vivus/blob/master/src/vivus.js#L333-L398)

岩层迁移参考了根据波形相位和振幅生成平滑曲线的做法。项目自行绘制可首尾相接的岩纹，在正面与侧面共同的展开坐标中平移，用两块固定轮廓裁切。[Wavify 曲线生成源码](https://github.com/peacepostman/wavify/blob/master/wavify.js#L43-L104)
