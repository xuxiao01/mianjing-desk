export interface ReadingAnchor {
  id?: string;
  offset: number;
  top: number;
  left: number;
}

export function captureReadingAnchor(
  container: HTMLElement,
  windowViewport = false,
): ReadingAnchor {
  const top = windowViewport ? 0 : container.getBoundingClientRect().top;
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

export function restoreReadingAnchor(
  container: HTMLElement,
  anchor: ReadingAnchor,
  windowViewport = false,
) {
  const row = [...container.querySelectorAll<HTMLElement>('[data-question-id]')].find(
    (element) => element.dataset.questionId === anchor.id,
  );
  const top = row
    ? container.scrollTop +
      row.getBoundingClientRect().top -
      (windowViewport ? 0 : container.getBoundingClientRect().top) -
      anchor.offset
    : anchor.top;
  const target = windowViewport ? window : container;
  target.scrollTo({
    top: Math.max(
      0,
      Math.min(
        top,
        container.scrollHeight - (windowViewport ? window.innerHeight : container.clientHeight),
      ),
    ),
    left: anchor.left,
    behavior: 'instant',
  });
}

export function nearReadingEnd(container: HTMLElement, windowViewport = false) {
  const height = windowViewport ? window.innerHeight : container.clientHeight;
  return (
    height > 0 &&
    container.scrollHeight > 0 &&
    container.scrollHeight - container.scrollTop - height <= 240
  );
}
