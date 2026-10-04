/**
 * Gerenciador corporativo de bloqueio de rolagem e prevenção de movimento de tela de fundo (Body Scroll Lock)
 * Impede que a página ao fundo se desloque, trema ou role quando qualquer modal estiver aberto
 * ou quando campos de formulário forem focados/digitados no celular ou desktop.
 */

let lockCount = 0;
let savedScrollY = 0;
let originalBodyStyles: {
  overflow: string;
  position: string;
  top: string;
  width: string;
  touchAction: string;
  overscrollBehavior: string;
} | null = null;

let originalHtmlStyles: {
  overflow: string;
  overscrollBehavior: string;
} | null = null;

export function lockScroll(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  lockCount++;

  if (lockCount === 1) {
    savedScrollY = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0;

    originalBodyStyles = {
      overflow: document.body.style.overflow,
      position: document.body.style.position,
      top: document.body.style.top,
      width: document.body.style.width,
      touchAction: document.body.style.touchAction,
      overscrollBehavior: document.body.style.overscrollBehavior,
    };

    originalHtmlStyles = {
      overflow: document.documentElement.style.overflow,
      overscrollBehavior: document.documentElement.style.overscrollBehavior,
    };

    document.documentElement.classList.add('modal-open');
    document.body.classList.add('modal-open');

    document.documentElement.style.overflow = 'hidden';
    document.documentElement.style.overscrollBehavior = 'none';

    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${savedScrollY}px`;
    document.body.style.width = '100%';
    document.body.style.touchAction = 'none';
    document.body.style.overscrollBehavior = 'none';
  }
}

export function unlockScroll(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  lockCount = Math.max(0, lockCount - 1);

  if (lockCount === 0) {
    document.documentElement.classList.remove('modal-open');
    document.body.classList.remove('modal-open');

    if (originalBodyStyles) {
      document.body.style.overflow = originalBodyStyles.overflow;
      document.body.style.position = originalBodyStyles.position;
      document.body.style.top = originalBodyStyles.top;
      document.body.style.width = originalBodyStyles.width;
      document.body.style.touchAction = originalBodyStyles.touchAction;
      document.body.style.overscrollBehavior = originalBodyStyles.overscrollBehavior;
    }

    if (originalHtmlStyles) {
      document.documentElement.style.overflow = originalHtmlStyles.overflow;
      document.documentElement.style.overscrollBehavior = originalHtmlStyles.overscrollBehavior;
    }

    window.scrollTo(0, savedScrollY);
    originalBodyStyles = null;
    originalHtmlStyles = null;
  }
}

/**
 * Previne que o toque ou scroll do mouse na área do modal vaze para a página ao fundo
 */
export function setupBackdropScrollLock(backdropElement: HTMLElement | null): () => void {
  if (!backdropElement) return () => {};

  const handleTouchMove = (e: TouchEvent) => {
    const target = e.target as HTMLElement | null;
    if (!target) return;

    // Se o toque foi direto no backdrop (fora da caixa de diálogo), cancela imediatamente
    if (target === backdropElement) {
      e.preventDefault();
      return;
    }

    // Se o elemento não faz parte de um container rolável com data-modal-scrollable, cancela
    const scrollable = target.closest('[data-modal-scrollable]') as HTMLElement | null;
    if (!scrollable) {
      // Inputs e textareas podem receber toques de seleção de texto, mas não arrastar o fundo
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'BUTTON') {
        return;
      }
      e.preventDefault();
      return;
    }

    // Se está dentro de um container rolável, impede o overflow chaining nos extremos
    const { scrollTop, scrollHeight, clientHeight } = scrollable;
    if (scrollHeight <= clientHeight) {
      e.preventDefault();
      return;
    }
  };

  const handleWheel = (e: WheelEvent) => {
    const target = e.target as HTMLElement | null;
    if (!target) return;

    if (target === backdropElement) {
      e.preventDefault();
      return;
    }

    const scrollable = target.closest('[data-modal-scrollable]') as HTMLElement | null;
    if (!scrollable) {
      e.preventDefault();
      return;
    }

    const { scrollTop, scrollHeight, clientHeight } = scrollable;
    const isAtTop = scrollTop <= 0 && e.deltaY < 0;
    const isAtBottom = scrollTop + clientHeight >= scrollHeight - 1 && e.deltaY > 0;

    if (isAtTop || isAtBottom) {
      e.preventDefault();
    }
  };

  backdropElement.addEventListener('touchmove', handleTouchMove, { passive: false });
  backdropElement.addEventListener('wheel', handleWheel, { passive: false });

  return () => {
    backdropElement.removeEventListener('touchmove', handleTouchMove);
    backdropElement.removeEventListener('wheel', handleWheel);
  };
}
