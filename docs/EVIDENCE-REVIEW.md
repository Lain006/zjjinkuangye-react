# 文献正文证据核验

2026-11-24。以本地课程验收库的 8 条已发布记录为本轮清单，逐条核对原文。种子数据已写入短摘录、出处位置和课程分析。现有库补齐只填空字段，已有课程分析会保留。首轮仅处理已发布记录，后续已扩展到全部 34 条馆藏，见下表。

| 文献 ID | 核对位置 | 课程分析落点 |
| --- | --- | --- |
| legacy-1 | [中国政府网](https://app.www.gov.cn/govdata/gov/202006/01/459230/article.html) 二（三）第9项 | 账户隔离与境内外资金路径 |
| legacy-4 | [海南自由贸易港](https://www.hnftp.gov.cn/xwzx/ywsd/202506/t20250606_3876398.html) 正文第1段，另对照[三亚新闻网同期报道](https://www.sanyarb.com.cn/sanyazonghe/2025/06/06/detail_20250606451276.html) | 获批主体和具体业务范围 |
| legacy-5 | [中国政府网](https://www.gov.cn/lianbo/bumen/202503/content_7013452.htm) 正文「内容主要包括」第2项，与[外汇局同题发布](https://www.safe.gov.cn/safe/2025/0313/25847.html)核对 | 试点主账户与境外成员收付 |
| legacy-6 | [国家网信办](https://www.cac.gov.cn/2024-03/22/c_1712776611775634.htm) 第三条 | 贸易和运输数据分类 |
| legacy-10 | [中国日报网](https://hain.chinadaily.com.cn/a/202603/01/WS69a402b5a310942cc49a107d.html) 正文第1段 | 海外运营职能与交易主体 |
| d6fc57e6-b1d8-42c2-9cd5-f2cd2e37c3a1 | [三亚市投资促进局转载](https://syipb.sanya.gov.cn/tzcjjsite/ywq/202610/a5a79e110983405783d2221f5a829e6a.shtml)「跳出‘资金外流’误区」第2段 | 迁驻、认定和备案分别取证 |
| 7e57b9ce-eccc-42d4-9c13-5285d4238fab | [国家外汇管理局海南省分局](https://www.safe.gov.cn/hainan/2026/0506/2372.html) 正文第2段 | 便利化政策落实与监管走访 |
| 86607266-c541-463d-97f1-a1f0a14d503a | [三亚市投资促进局转载](https://syipb.sanya.gov.cn/tzcjjsite/zyswj/202608/a6cd984629d14f2db2d6eedf39e71475.shtml) 正文第1段 | 总部认定、资金业务与税务条件的文件证据 |

## 本地回填

使用已执行迁移的验收库，先预览本次会填充的字段，再执行写入。脚本按文献 ID 和原始来源 URL 配对，每次写入与审计记录共用事务。二次运行可检查是否还需要写入。若线上目录比种子清单更大，预览会列出未匹配的数据库记录、状态及其缺项，供后续补核。线上接口本次返回 HTTP 403，截图中的 19 条公开记录未作为本地清单的覆盖证明。

```console
npm run evidence:backfill -w backend -- --all
npm run evidence:backfill -w backend -- --all --apply
npm run evidence:backfill -w backend -- --all
```


## 26 条草稿的核验补录

本轮为 26 条草稿补齐短摘录、出处和课程分析，维持原有草稿状态。出处与旧编目链接不同时，详情页会单独链接实际引文。政策目录的旧日期和目前引文所用文件的日期采用各自口径。

| 文献 ID | 实际摘录出处 | 核对位置 |
| --- | --- | --- |
| legacy-2 | [官方来源](https://www.mof.gov.cn/zcsjtsgb/gfxwj/202006/t20200623_3583820.htm) | 财税〔2020〕31号第一条 |
| legacy-3 | [官方来源](https://cws.mofcom.gov.cn/swcjzc/art/2025/art_aed05e0d9ef34930ad1ccfaffb7baac5.html) | 海关总署加工增值货物税收征管暂行办法第二条，计算口径见第四条 |
| legacy-7 | [官方来源](https://www.oecd.org/en/publications/oecd-due-diligence-guidance-for-responsible-supply-chains-of-minerals-from-conflict-affected-and-high-risk-areas_9789264252479-en.html) | OECD 出版页 Abstract 第1段 |
| legacy-8 | [官方来源](https://taxation-customs.ec.europa.eu/carbon-border-adjustment-mechanism_en) | 欧盟委员会专题页导言，欧盟排放交易体系段 |
| legacy-9 | [官方来源](https://dataclouds.cninfo.com.cn/shgonggao/2025/2025-03-22/fe09cf44064f11f0b2f2fa163e957f7a.pdf) | 《紫金矿业2024年可持续发展报告》环境管理体系，印刷第38页（PDF 第40页） |
| legacy-11 | [官方来源](https://english.www.gov.cn/archive/whitepaper/202112/29/content_WS61cc01b8c6d09c94e48a2df0.html) | 中国出口管制白皮书，Improved policy guidance 段 |
| legacy-12 | [官方来源](https://en.spp.gov.cn/2021-12/29/c_948419_2.htm) | 《个人信息保护法》英文版第三章第39条 |
| legacy-13 | [官方来源](https://www.fatf-gafi.org/content/dam/fatf-gafi/recommendations/FATF%20Recommendations%202012.pdf.coredownload.inline.pdf) | FATF 建议1，Assessing risks and applying a risk-based approach |
| legacy-14 | [官方来源](https://commission.europa.eu/topics/business-and-industry/doing-business-eu/sustainability-due-diligence-responsible-business/corporate-sustainability-due-diligence_en) | 欧盟委员会专题页，What are the obligations for companies? |
| legacy-15 | [官方来源](https://single-market-economy.ec.europa.eu/sectors/raw-materials/areas-specific-interest/critical-raw-materials/critical-raw-materials-act_en) | 欧盟委员会专题页，Setting benchmarks by 2030 for domestic capacities |
| legacy-16 | [官方来源](https://eur-lex.europa.eu/eli/reg/2023/1542/2023-07-28) | 欧盟电池法规原始版本第49条第1款(d) |
| legacy-17 | [官方来源](https://www.dhs.gov/sites/default/files/2023-08/23_0728_plcy_uflpa-strategy-2023-update-508.pdf) | 美国国土安全部《2023 年 UFLPA 执行策略更新》Executive Summary |
| legacy-18 | [官方来源](https://www.unep.org/resources/report/global-industry-standard-tailings-management) | 联合国环境署资料库，摘要 |
| legacy-19 | [官方来源](https://equator-principles.com/) | 赤道原则官方网站首页，The Equator Principles |
| legacy-20 | [官方来源](https://www.gold.org/about-gold/gold-supply/responsible-gold/responsible-gold-mining-principles) | 世界黄金协会专题页，Assurance 段 |
| legacy-21 | [官方来源](https://taxation-customs.ec.europa.eu/customs/aeo-authorised-economic-operator_en) | 欧盟委员会 AEO 专题页，项目概述 |
| legacy-22 | [官方来源](https://english.court.gov.cn/2015-08/17/c_761486.htm) | 《矿山安全法》英文版第3条 |
| legacy-23 | [官方来源](https://www.oecd.org/publications/oecd-guidelines-for-multinational-enterprises-on-responsible-business-conduct-81f92357-en.htm) | OECD 2023 年版出版页，Abstract |
| legacy-24 | [官方来源](https://www.cbd.int/gbf/targets/15) | 《昆明—蒙特利尔全球生物多样性框架》目标15 |
| legacy-25 | [官方来源](https://home.treasury.gov/news/press-releases/sm680) | 美国财政部新闻稿，首段 |
| legacy-26 | [官方来源](https://eur-lex.europa.eu/legal-content/en/TXT/?uri=CELEX%3A32017R0821) | 欧盟冲突矿产法规第6条第1款，例外见第2款 |
| legacy-27 | [官方来源](https://eiti.org/sites/default/files/2024-04/2023%20EITI%20Standard_Part%201_Principles%20and%20requirements.pdf) | 《2023 EITI 标准》第2.5(c)项，印刷第20页 |
| legacy-28 | [官方来源](https://www.ifc.org/en/insights-reports/2012/ifc-performance-standard-1) | IFC 绩效标准1专题页，2012 年版概述首段 |
| legacy-29 | [官方来源](https://www.ifrs.org/issued-standards/ifrs-sustainability-standards-navigator/ifrs-s2-climate-related-disclosures/) | IFRS S2 标准说明，About 的适用范围段 |
| legacy-30 | [官方来源](https://www.basel.int/TheConvention/Overview/tabid/1271/ItemId/2193/Default.aspx) | 巴塞尔公约官网，Regulatory system 段，第6和第7条 |
| legacy-31 | [官方来源](https://www.esdm.go.id/id/media-center/arsip-berita/hilirisasi-nikel-hasilkan-nilai-tambah-industri-baterai-kendaraan-listrik) | 印尼能源与矿产资源部 2024 年第418号新闻稿，正文第1段（同主题官方补证） |

印尼镍产业条目（legacy-31）的原 2025—2035 路线图版本仍未核实。现有摘录来自同一主管部门发布的 2024 年新闻稿，用于提供主题背景。发布前应核实旧题名对应的原文件，或按该新闻稿重新编目。
