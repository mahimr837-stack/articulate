export function getPanelPresentation(open: boolean) {
  return {
    panelStateClass: open ? "is-open" : "is-closed",
    railStateClass: open ? "is-hidden" : "",
    ariaHidden: !open,
    inert: !open,
  };
}
