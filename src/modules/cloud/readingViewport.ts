export interface ReadingAnchor {
  id?: string;
  offset: number;
  top: number;
  left: number;
}

export function captureReadingAnchor(container: HTMLElement): ReadingAnchor {
  const top = container.getBoundingClientRect().top;
  const row = [...container.querySelectorAll<HTMLElement>('[data-question-id]')].find(
    (element) => element.getBoundingClientRect().bottom > top,
  );
  return {
    id: row?.dataset.questionId,
    offset: row ? row.getBoundingClientRect().top - top : 0,
    top: container.scrollTop,
    left: container.scrollLeft,
  };
}

export function restoreReadingAnchor(container: HTMLElement, anchor: ReadingAnchor) {
  const row = [...container.querySelectorAll<HTMLElement>('[data-question-id]')].find(
    (element) => element.dataset.questionId === anchor.id,
  );
  const top = row
    ? container.scrollTop +
      row.getBoundingClientRect().top -
      container.getBoundingClientRect().top -
      anchor.offset
    : anchor.top;
  container.scrollTo({
    top: Math.max(0, Math.min(top, container.scrollHeight - container.clientHeight)),
    left: anchor.left,
    behavior: 'instant',
  });
}

export function nearReadingEnd(container: HTMLElement) {
  return (
    container.clientHeight > 0 &&
    container.scrollHeight - container.scrollTop - container.clientHeight <= 240
  );
}
