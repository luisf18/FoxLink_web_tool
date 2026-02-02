export function createToolbar(options = {}) {
    const {
        label = null,
        labelFull = false,
        style = "outline",
        columns = 5,
        direction = "row",
        tools = []
    } = options;

    const toolbar = document.createElement("div");
    toolbar.className = "toolbar";

    const grid = document.createElement("div");
    grid.className = `tool-grid style-${style}`;
    grid.style.gridTemplateColumns =
        direction === "row"
            ? `repeat(${columns}, 1fr)`
            : `repeat(auto-fill, 1fr)`;

    /* label opcional */
    if (label) {
        const labelEl = document.createElement("div");
        labelEl.className = `tool-label style-${style}`;
        labelEl.textContent = label;

        if (labelFull) {
            labelEl.style.width = "100%";
            labelEl.style.textAlign = "center";
        } else {
            /* só recorta o canto quando label NÃO é full */
            grid.style.borderRadius = "0 12px 12px 12px";
        }

        toolbar.appendChild(labelEl);
    }

    tools.forEach(t => {
        const a = document.createElement("a");
        a.href = t.link || "#";
        a.dataset.label = t.label || "";
        a.target = t.target || "_blank";

        const i = document.createElement("i");
        i.className = `bi ${t.icon}`;

        a.appendChild(i);
        grid.appendChild(a);
    });

    toolbar.appendChild(grid);
    return toolbar;
}
