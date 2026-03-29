"""
Seed test data: world of 星裂紀元 (Stellar Fracture Era).

Characters, locations, factions, and plot threads that match
the UI examples in the plan (Kael, 莉雅, 徽章伏筆, etc.).
"""
from __future__ import annotations

from . import crud
from .schema import (
    ArtifactNode,
    CharacterNode,
    CharacterRelationshipEdge,
    FactionNode,
    FactionRelationshipEdge,
    LocationNode,
    PlotThreadNode,
    ProjectNode,
    StoryArcNode,
    WorldEventNode,
)


async def seed_all() -> str:
    """Create the full test world. Returns the project_id."""

    # ── Project ──────────────────────────────────────────────
    project = ProjectNode(
        name="星裂紀元",
        description=(
            "在魔法與科技並存的世界，被稱為「裂痕」的神秘空間裂縫正在吞噬大陸。"
            "帝國以鐵腕壓制真相，而一名失去父親的年輕人踏上追尋裂痕秘密的旅途。"
        ),
        genre="奇幻",
        language="zh",
    )
    await crud.create_project(project)
    pid = project.id

    # ── Factions ─────────────────────────────────────────────
    empire = FactionNode(
        project_id=pid,
        name="水晶帝國",
        ideology="秩序至上，穩定壓倒一切",
        goals="維持帝國版圖，封鎖關於裂痕的真相",
        resources="龐大的軍事力量、水晶能源壟斷、資訊管制系統",
        power_level=9,
    )
    seekers = FactionNode(
        project_id=pid,
        name="裂痕探索者聯盟",
        ideology="真相必須被揭露，即使代價高昂",
        goals="研究裂痕的成因，找到阻止其擴張的方法",
        resources="分散的成員網路、古老的研究資料、非正規管道",
        power_level=3,
    )
    await crud.create_faction(empire)
    await crud.create_faction(seekers)

    # Empire vs Seekers relationship
    await crud.upsert_faction_relationship(FactionRelationshipEdge(
        source_id=empire.id,
        target_id=seekers.id,
        type="conflict",
        public_stance="聯盟是危險的陰謀論散播者",
        secret_stance="聯盟掌握著帝國最不願被公開的秘密",
        tension_level=9,
    ))

    # ── Characters ───────────────────────────────────────────
    kael = CharacterNode(
        project_id=pid,
        name="凱爾",
        aliases=["Kael", "裂縫孩子（蔑稱）"],
        role="protagonist",
        gender="男",
        age="22",
        appearance="深色短髮，左手腕有一道細長的裂紋狀胎記，眼神銳利但常帶疲憊",
        # GOLEM
        core_desire="找到失蹤的父親，揭開裂痕的真相",
        core_fear="成為像父親一樣被世界遺棄、被人遺忘的人",
        wound="7歲時親眼目睹父親消失於裂痕之中，屍骨無存",
        belief="真相比安全更重要——即使那個真相會讓人痛苦（可能是錯的信念）",
        moral_code="不對弱者動手，但對阻擋真相的人毫不留情",
        # Behavior
        behavior_pattern="行動前過度分析，但一旦決定便義無反顧；迴避談及父親",
        speech_style="直接、簡短，不善言辭；談及裂痕時語氣會不自覺地放慢並停頓",
        speech_samples=[
            "「裂痕不會憑空出現。有人知道原因。」",
            "「我不需要你的同情，我需要答案。」",
            "（沉默三秒）「……我父親也這麼說過。」",
        ],
        # Arc
        arc_start="憤世嫉俗的獨行者，靠替人跑腿維生，刻意遠離帝國管轄區",
        arc_end="理解父親當年的選擇，學會在真相與保護他人之間取得平衡",
        current_state="剛發現父親徽章上的隱藏符文，陷入困惑與不安",
        faction_id=seekers.id,
    )

    liya = CharacterNode(
        project_id=pid,
        name="莉雅",
        aliases=["Liya", "冰晶督察"],
        role="supporting",
        gender="女",
        age="28",
        appearance="銀白色長髮束成精緻髮型，帝國制服永遠筆挺，舉止優雅但眼神永遠在評估對方",
        # GOLEM
        core_desire="維護帝國的穩定秩序，讓大規模悲劇永不重演",
        core_fear="失去控制，讓混亂再次奪走她無力保護的人",
        wound="十六歲時親眼目睹裂痕事件中整個村莊在混亂中覆滅",
        belief="秩序需要犧牲個體自由來維持——那些反對者只是沒見過真正的混亂",
        moral_code="個人情感不能干預職責，但職責的邊界由她自己定義",
        # Behavior
        behavior_pattern="凡事提前三步計劃；對下屬嚴苛但公平；獨處時會反覆閱讀那個村莊的事件報告",
        speech_style="優雅、精確，帶有官方語氣；從不說廢話；偶爾一句話帶兩層意思",
        speech_samples=[
            "「規則存在是有原因的。例外存在的原因，是讓人明白規則的必要性。」",
            "「你的調查結果很有趣，凱爾先生。有趣到足以讓帝國關注你。」",
            "「我不需要你相信我。我需要你不要礙事。」",
        ],
        # Arc
        arc_start="帝國忠誠督察，相信秩序是保護人民的唯一方式",
        arc_end="發現帝國一直在用她信奉的秩序掩蓋更大的罪行，必須重新定義忠誠",
        current_state="奉命監視凱爾，但開始注意到他查到的資料有某些帝國從未公開的細節",
        faction_id=empire.id,
    )

    await crud.create_character(kael)
    await crud.create_character(liya)

    # Kael ↔ Liya relationship
    await crud.upsert_character_relationship(CharacterRelationshipEdge(
        source_id=kael.id,
        target_id=liya.id,
        type="rival",
        trust_level=-20,
        public_face="督察與被監視對象",
        true_face="互相認出對方身上某種相似的執著，但都不願承認",
        known_secrets=["莉雅知道凱爾父親是前帝國研究員"],
        valid_from="第一章第一幕",
    ))

    # ── Locations ────────────────────────────────────────────
    observatory = LocationNode(
        project_id=pid,
        name="裂痕觀測站",
        description=(
            "帝國二十年前設立的研究設施，在一次重大事故後被封存。"
            "建築外牆佈滿裂紋，部分區域仍有能量殘留在閃爍。"
        ),
        atmosphere="荒廢、壓抑，空氣中有一股說不清的金屬氣味；夜晚裂痕發出微弱藍光",
        significance="凱爾父親最後工作的地方，也是故事核心秘密的所在地",
    )
    capital = LocationNode(
        project_id=pid,
        name="水晶城",
        description=(
            "帝國首都，以巨型水晶能源塔為地標。"
            "繁華的表面下是嚴密的監控網路和資訊管制。"
        ),
        atmosphere="表面光鮮，水晶折射出五彩光芒；但街道上的帝國士兵讓人感到窒息",
        significance="帝國權力核心，莉雅的根據地，凱爾的危險地帶",
    )
    await crud.create_location(observatory)
    await crud.create_location(capital)

    # ── Artifacts ────────────────────────────────────────────
    badge = ArtifactNode(
        project_id=pid,
        name="父親的徽章",
        description="一枚普通外觀的研究員徽章，凱爾父親消失時遺留的唯一物品。背面有用微型刻痕寫成的符文。",
        power="尚未確認。符文在靠近裂痕時會發出微弱熱感。",
        history="帝國第七研究所發放，編號E-077，持有人：凱爾之父（艾登·莫斯）",
        current_owner=kael.id,
    )
    await crud.create_artifact(badge)

    # ── Plot Threads (Foreshadowing) ──────────────────────────
    badge_mystery = PlotThreadNode(
        project_id=pid,
        name="徽章之謎",
        description=(
            "凱爾父親留下的徽章背面有隱藏符文。"
            "符文的含義、目的以及為何只有凱爾能感應到它的反應，均未解答。"
        ),
        planted_at="第一章第一幕",
        status="active",
    )
    rift_voice = PlotThreadNode(
        project_id=pid,
        name="裂痕之聲",
        description=(
            "凱爾在接近裂痕時偶爾會聽見微弱的聲音，有時像是自己父親的聲音。"
            "無人能確認這是幻覺、裂痕的特性，還是某種通訊。"
        ),
        planted_at="第一章第三幕",
        status="active",
    )
    empire_secret = PlotThreadNode(
        project_id=pid,
        name="帝國封存報告",
        description=(
            "莉雅的調查檔案中有一份被塗黑的報告，編號與凱爾父親的研究所相符。"
            "她尚未意識到這份報告的重要性。"
        ),
        planted_at="第二章第一幕",
        status="active",
    )
    await crud.create_plot_thread(badge_mystery)
    await crud.create_plot_thread(rift_voice)
    await crud.create_plot_thread(empire_secret)

    # ── World Events ─────────────────────────────────────────
    first_rift = WorldEventNode(
        project_id=pid,
        name="第一道大裂痕出現",
        description=(
            "二十年前，世界第一道大規模裂痕在北方平原開啟，"
            "吞噬了三個村莊共一千二百名居民。帝國隨即封鎖該區域並實施資訊管制。"
        ),
        time_in_world="故事開始前20年",
        impact="引發帝國對裂痕研究的秘密投資，也造成莉雅的童年創傷",
    )
    kael_father_disappearance = WorldEventNode(
        project_id=pid,
        name="艾登失蹤事件",
        description=(
            "凱爾的父親艾登·莫斯在裂痕觀測站的一次實驗中消失。"
            "帝國公開說法：研究意外。實際原因成謎。"
        ),
        time_in_world="故事開始前15年",
        impact="凱爾的核心動機。帝國隨後關閉觀測站。",
    )
    await crud.create_world_event(first_rift)
    await crud.create_world_event(kael_father_disappearance)

    # ── Story Arc ─────────────────────────────────────────────
    main_arc = StoryArcNode(
        project_id=pid,
        name="裂痕真相弧",
        theme="真相的代價——當你追尋真相，你是否準備好承受它改變一切？",
        emotional_goal="從憤怒與迷失，走向理解與選擇",
    )
    await crud.create_story_arc(main_arc)

    return pid


async def print_summary(project_id: str) -> None:
    """Print a quick summary of seeded data."""
    project = await crud.get_project(project_id)
    characters = await crud.list_characters(project_id)
    locations = await crud.list_locations(project_id)
    threads = await crud.list_active_plot_threads(project_id)
    factions = await crud.list_factions(project_id)

    print(f"\n{'='*50}")
    print(f"  Project: {project['name']} ({project_id[:8]}...)")
    print(f"{'='*50}")
    print(f"  Characters ({len(characters)}): {', '.join(c['name'] for c in characters)}")
    print(f"  Locations  ({len(locations)}): {', '.join(l['name'] for l in locations)}")
    print(f"  Factions   ({len(factions)}): {', '.join(f['name'] for f in factions)}")
    print(f"  Active plot threads ({len(threads)}):")
    for t in threads:
        print(f"    - {t['name']}: {t['description'][:60]}...")
    print()
