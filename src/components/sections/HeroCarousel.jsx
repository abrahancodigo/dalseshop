import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useImage } from "@/context/ImageContext";
import { useMediaQuery } from "@/hooks/useViewport";
import { slideDistance, swipeStep } from "@/lib/carousel.mjs";
import StoreImage, { getImageMetadata } from "@/components/store/StoreImage";
import styles from "./sections.module.css";

const Arrow = ({ previous = false }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
    <polyline points={previous ? "15 18 9 12 15 6" : "9 18 15 12 9 6"} />
  </svg>
);

export default function HeroCarousel({ config, priority = false }) {
  const slides = useMemo(() => config.slides?.length ? config.slides : [{ ...config }], [config]);
  const { openImage } = useImage();
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const [current, setCurrent] = useState(0);
  const [previous, setPrevious] = useState(null);
  const [animating, setAnimating] = useState(false);
  const [direction, setDirection] = useState(1);
  const [modalIndex, setModalIndex] = useState(null);
  const [inView, setInView] = useState(false);
  const [pageVisible, setPageVisible] = useState(() => !document.hidden);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [paused, setPaused] = useState(false);
  const [interaction, setInteraction] = useState(0);
  const heroRef = useRef(null);
  const closeRef = useRef(null);
  const modalRef = useRef(null);
  const pointer = useRef(null);
  const suppressClick = useRef(false);
  const animationTimer = useRef(null);
  const clickTimer = useRef(null);
  const active = current % slides.length;
  const multiple = slides.length > 1;
  const transition = reducedMotion ? "fade" : config.transition || "cube";
  const metadata = getImageMetadata(slides[0]?.image);

  const finishAnimation = useCallback(() => {
    clearTimeout(animationTimer.current);
    setAnimating(false);
    setPrevious(null);
  }, []);

  const goTo = useCallback((index, step = 1, manual = false) => {
    const next = (index + slides.length) % slides.length;
    if (animating || next === active) return;
    if (manual) setInteraction((value) => value + 1);
    setPrevious(active);
    setDirection(step);
    setCurrent(next);
    setAnimating(!reducedMotion);
    clearTimeout(animationTimer.current);
    animationTimer.current = setTimeout(finishAnimation, reducedMotion ? 0 : 500);
  }, [active, animating, slides.length, reducedMotion, finishAnimation]);

  useEffect(() => {
    const observer = "IntersectionObserver" in window ? new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.1 }) : null;
    if (observer) observer.observe(heroRef.current);
    else setInView(true);
    const visibility = () => setPageVisible(!document.hidden);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      observer?.disconnect();
      document.removeEventListener("visibilitychange", visibility);
      clearTimeout(animationTimer.current);
      clearTimeout(clickTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!multiple || !inView || !pageVisible || reducedMotion || paused || hovered || focused || dragging || animating || modalIndex !== null) return;
    const baseDelay = Math.max(2, Number(config.autoplaySpeed) || 5) * 1000;
    const timer = setTimeout(() => goTo(active + 1), interaction ? Math.max(baseDelay, 6000) : baseDelay);
    return () => clearTimeout(timer);
  }, [multiple, inView, pageVisible, reducedMotion, paused, hovered, focused, dragging, animating, modalIndex, active, goTo, config.autoplaySpeed, interaction]);

  useEffect(() => {
    if (modalIndex === null) return;
    const oldFocus = document.activeElement;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const keydown = (event) => {
      if (event.key === "Escape") setModalIndex(null);
      if (event.key === "ArrowLeft") setModalIndex((index) => (index - 1 + slides.length) % slides.length);
      if (event.key === "ArrowRight") setModalIndex((index) => (index + 1) % slides.length);
      if (event.key === "Tab") {
        const buttons = [...modalRef.current.querySelectorAll("button")];
        const first = buttons[0];
        const last = buttons.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("keydown", keydown);
      document.body.style.overflow = oldOverflow;
      oldFocus?.focus?.({ preventScroll: true });
    };
  }, [modalIndex !== null, slides.length]);

  const handlePointerDown = (event) => {
    if (!multiple || !event.isPrimary || event.button !== 0 || event.target.closest("button, a")) return;
    pointer.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
    suppressClick.current = false;
    setDragging(true);
  };
  const handlePointerMove = (event) => {
    const start = pointer.current;
    if (!start || start.id !== event.pointerId) return;
    if (swipeStep(event.clientX - start.x, event.clientY - start.y, event.currentTarget.clientWidth)) {
      suppressClick.current = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  };
  const handlePointerEnd = (event) => {
    const start = pointer.current;
    if (!start || start.id !== event.pointerId) return;
    if (event.type !== "pointercancel") {
      const step = swipeStep(event.clientX - start.x, event.clientY - start.y, event.currentTarget.clientWidth);
      if (step) { suppressClick.current = true; goTo(active + step, step, true); }
    }
    pointer.current = null;
    setDragging(false);
    clearTimeout(clickTimer.current);
    clickTimer.current = setTimeout(() => { suppressClick.current = false; }, 250);
  };

  const getSlideStyle = (index) => {
    let distance = slideDistance(index, active, slides.length);
    if (slides.length === 2 && distance !== 0) distance *= direction;
    const center = distance === 0;
    const adjacent = Math.abs(distance) === 1;
    const outgoing = animating && index === previous;
    let transform = "translateX(0) scale(1)";
    let opacity = center ? 1 : 0;
    let visible = center || outgoing;
    if (transition === "cube" || !["fade", "slide", "zoom", "blur", "flip", "kenburn"].includes(transition)) {
      transform = center ? "translateX(0) scale(1) rotateY(0deg)" : `translateX(${distance > 0 ? 50 : -50}%) scale(${adjacent ? 0.8 : 0.5}) rotateY(${distance > 0 ? -35 : 35}deg)`;
      opacity = center ? 1 : adjacent ? 0.6 : 0;
      visible ||= adjacent;
    } else if (transition === "flip") {
      transform = center ? "translateX(0) rotateY(0deg) scale(1)" : `translateX(${distance > 0 ? 30 : -30}%) rotateY(${distance > 0 ? -90 : 90}deg) scale(0.8)`;
      visible ||= adjacent;
    } else if (transition === "slide") {
      transform = `translateX(${center ? 0 : distance > 0 ? 100 : -100}%)`;
    } else if (transition === "zoom") {
      transform = `scale(${center ? 1 : distance > 0 ? 1.15 : 0.85})`;
    } else if (transition === "blur") {
      transform = `scale(${center ? 1 : 1.03})`;
    }
    return { transform, opacity, visibility: visible ? "visible" : "hidden", zIndex: center ? 10 : adjacent ? 5 : 1 };
  };

  return <>
    <section
      ref={heroRef} className={styles.hero} role="region" aria-roledescription="carrusel" aria-label="Promociones de la tienda" tabIndex={0}
      style={{ minHeight: `${Number(config.height) || 500}px`, "--hero-image-ratio": metadata ? `${metadata.width} / ${metadata.height}` : "16 / 9" }}
      onPointerEnter={(event) => { if (event.pointerType === "mouse") setHovered(true); }} onPointerLeave={() => setHovered(false)}
      onFocusCapture={(event) => setFocused(event.target.matches(":focus-visible"))} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}
      onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerEnd} onPointerCancel={handlePointerEnd}
      onClickCapture={(event) => { if (suppressClick.current) { event.preventDefault(); event.stopPropagation(); } }}
      onKeyDown={(event) => { if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); const step = event.key === "ArrowLeft" ? -1 : 1; goTo(active + step, step, true); } }}
    >
      <div className={styles.coverflowContainer}>
        {slides.map((slide, index) => {
          const loadImage = Math.abs(slideDistance(index, active, slides.length)) <= 1 || (animating && index === previous);
          return <div key={index} className={styles.heroSlide} style={getSlideStyle(index)} role="group" aria-label={`${index + 1} de ${slides.length}`} aria-hidden={index !== active} inert={index !== active}
            onTransitionEnd={(event) => { if (index === active && event.target === event.currentTarget && ["transform", "opacity"].includes(event.propertyName)) finishAnimation(); }}>
            <div className={`${styles.slideCard} ${transition === "kenburn" && index === active && inView && pageVisible && !paused ? styles.slideCardKenburn : ""}`}>
              {slide.image && loadImage && <StoreImage src={slide.image} alt={slide.title || "Promoción de la tienda"} className={styles.heroSlideImg}
                sizes="(max-width: 768px) 94vw, (max-width: 1200px) 70vw, 840px"
                loading={priority && index === 0 ? "eager" : "lazy"} fetchPriority={priority && index === 0 ? "high" : "low"} draggable={false}
                onClick={() => { if (config.clickable === true || config.clickable === "true") setModalIndex(index); else openImage(slide.image); }}
                style={{ cursor: "zoom-in" }} />}
              <div className={styles.heroOverlay} style={{ opacity: (Number(config.overlayOpacity ?? 30)) / 100, pointerEvents: "none" }} />
              <div className={styles.heroContent} style={{ pointerEvents: "none" }}>
                {slide.title && <h1 className={styles.heroTitle}>{slide.title}</h1>}
                {slide.subtitle && <p className={styles.heroSubtitle}>{slide.subtitle}</p>}
                {slide.buttonText && <Link to={slide.buttonLink || "#"} className={styles.heroBtn} style={{ pointerEvents: "auto" }}>{slide.buttonText}</Link>}
              </div>
            </div>
          </div>;
        })}
      </div>
      {multiple && <>
        <button className={`${styles.heroArrow} ${styles.heroArrowPrev}`} onClick={() => goTo(active - 1, -1, true)} aria-label="Promoción anterior"><Arrow previous /></button>
        <button className={`${styles.heroArrow} ${styles.heroArrowNext}`} onClick={() => goTo(active + 1, 1, true)} aria-label="Promoción siguiente"><Arrow /></button>
        <button className={styles.heroPlayPause} onClick={() => { if (paused) { setFocused(false); setHovered(false); } setPaused((value) => !value); }} aria-label={paused ? "Reproducir promociones" : "Pausar promociones"} aria-pressed={paused}>{paused ? "▶" : "Ⅱ"}</button>
        <div className={styles.heroCounter} aria-live="off">{active + 1} / {slides.length}</div>
        <div className={styles.heroThumbs} aria-label="Elegir promoción">
          {slides.map((slide, index) => <button key={index} className={`${styles.heroThumb} ${index === active ? styles.heroThumbActive : ""}`}
            onClick={() => goTo(index, slideDistance(index, active, slides.length) < 0 ? -1 : 1, true)} aria-label={`Ver promoción ${index + 1}`} aria-current={index === active ? "true" : undefined}>
            <StoreImage src={slide.image} alt="" sizes="70px" className={styles.heroThumbImg} draggable={false} />
          </button>)}
        </div>
      </>}
    </section>
    {modalIndex !== null && <div className={styles.heroModalOverlay} onClick={() => setModalIndex(null)}>
      <div ref={modalRef} className={styles.heroModalContent} onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="Ver promoción completa">
        <button ref={closeRef} className={styles.heroModalClose} onClick={() => setModalIndex(null)} aria-label="Cerrar promoción">✕</button>
        {multiple && <button className={`${styles.heroModalArrow} ${styles.heroModalArrowPrev}`} onClick={() => setModalIndex((index) => (index - 1 + slides.length) % slides.length)} aria-label="Imagen anterior"><Arrow previous /></button>}
        <img src={slides[modalIndex % slides.length].image} alt={slides[modalIndex % slides.length].title || "Promoción completa"} className={styles.heroModalImage} decoding="async" />
        {multiple && <button className={`${styles.heroModalArrow} ${styles.heroModalArrowNext}`} onClick={() => setModalIndex((index) => (index + 1) % slides.length)} aria-label="Imagen siguiente"><Arrow /></button>}
        {multiple && <div className={styles.heroModalCounter}>{modalIndex + 1} / {slides.length}</div>}
      </div>
    </div>}
  </>;
}
