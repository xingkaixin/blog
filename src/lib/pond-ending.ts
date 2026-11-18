function fraction(value: number, from: number, to: number) {
  return Math.min(1, Math.max(0, (value - from) / (to - from)));
}

export function bindPondEnding(ending: HTMLElement) {
  const track = ending.querySelector<HTMLElement>(".track")!;
  const shot = ending.querySelector<HTMLElement>(".shot")!;
  const water = ending.querySelector<HTMLElement>(".water")!;
  const comic = ending.querySelector<HTMLElement>("figure")!;
  const cut = ending.querySelector<SVGPathElement>("[data-cut]")!;
  const glint = ending.querySelector<SVGGElement>("[data-glint]")!;
  let previous: number | undefined;

  return (reducedMotion: boolean, pastShore: number) => {
    ending.toggleAttribute("data-motion", !reducedMotion);
    if (reducedMotion) {
      water.hidden = false;
      water.inert = false;
      ending.removeAttribute("data-wiping");
      previous = undefined;
      return;
    }

    // sticky 面板相对轨道走过的距离就是滚动进度，正反向共用同一帧。
    const p =
      pastShore > 0 ? fraction(shot.offsetTop, 0, track.offsetHeight - shot.offsetHeight) : 0;
    if (p === previous) {
      return;
    }
    previous = p;

    // 画中水面在高度的 49%，亮边在这里交接，水下改用柔边显影。
    const edge = -0.06 + 0.55 * fraction(p, 0.04, 0.47) + 0.57 * fraction(p, 0.5, 0.93);
    const grade = fraction(p, 0.08, 0.56);
    const feather = 0.14 * fraction(p, 0.47, 0.6);
    ending.toggleAttribute("data-wiping", p > 0.04 && p < 0.93);
    water.inert = p > 0.04;
    water.hidden = p >= 0.93;
    shot.style.setProperty("--framing", String(fraction(p, 0.04, 0.42)));
    water.style.setProperty("--grade", String(grade));
    water.style.setProperty(
      "--feather",
      feather > 0
        ? `linear-gradient(transparent ${(edge - 0.018) * 100}%, black ${(edge + feather) * 100}%)`
        : "none",
    );
    cut.setAttribute("transform", `translate(0,${edge})`);
    glint.setAttribute("transform", `translate(0,${edge * 1000})`);
    glint.setAttribute("opacity", String(fraction(p, 0.04, 0.12) * (1 - fraction(p, 0.46, 0.56))));
    comic.style.setProperty("--caption-opacity", String(fraction(p, 0.93, 1)));
  };
}
