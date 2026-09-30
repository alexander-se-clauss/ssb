/**
 * Key presses that already changed the screen. Every screen listens on `window`, so without
 * this one Esc could close a screen and then also close the one it just opened.
 * (`defaultPrevented` can't be used: the keyboard input adapter prevents defaults too.)
 */
const handled = new WeakSet<Event>();

export const markHandled = (event: Event): void => {
  handled.add(event);
  event.preventDefault();
};

export const wasHandled = (event: Event): boolean => handled.has(event);
