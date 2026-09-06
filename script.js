/* =========================
   ФОНОВАЯ МУЗЫКА
========================= */

const backgroundMusic = document.querySelector("#background-music");
const entryScreen = document.querySelector(".entry-screen");
const entryButton = document.querySelector(".entry-button");
const musicPositionKey = "hdf-music-position";
const entrySeenKey = "hdf-entry-seen";
const musicVolumeKey = "hdf-music-volume";
const musicMutedKey = "hdf-music-muted";
const musicFadeDuration = 450;
const audioToggle = document.querySelector(".audio-toggle");
const volumeSlider = document.querySelector(".volume-slider input");
let musicFadeFrame = null;
let musicFadeToken = 0;
let userVolume = Number(sessionStorage.getItem(musicVolumeKey));
let isMusicMuted = sessionStorage.getItem(musicMutedKey) === "true";

if (!Number.isFinite(userVolume) || userVolume < 0 || userVolume > 1) {
    userVolume = 1;
}

const navigationEntry = performance.getEntriesByType("navigation")[0];
const isPageReload = navigationEntry?.type === "reload";

if (isPageReload) {
    sessionStorage.removeItem(musicPositionKey);
}

const restoreMusicPosition = () => {
    if (!backgroundMusic) {
        return;
    }

    const savedPosition = Number(sessionStorage.getItem(musicPositionKey));

    if (!Number.isFinite(savedPosition) || savedPosition < 0) {
        return;
    }

    const setPosition = () => {
        if (savedPosition < backgroundMusic.duration) {
            backgroundMusic.currentTime = savedPosition;
        }
    };

    if (backgroundMusic.readyState >= 1) {
        setPosition();
    } else {
        backgroundMusic.addEventListener("loadedmetadata", setPosition, { once: true });
    }
};

const saveMusicPosition = () => {
    if (backgroundMusic && Number.isFinite(backgroundMusic.currentTime)) {
        sessionStorage.setItem(musicPositionKey, backgroundMusic.currentTime.toString());
    }
};

const fadeMusicTo = (targetVolume, onComplete) => {
    if (!backgroundMusic) {
        return;
    }

    if (musicFadeFrame) {
        cancelAnimationFrame(musicFadeFrame);
    }

    const fadeToken = ++musicFadeToken;
    const startVolume = backgroundMusic.volume;
    const startTime = performance.now();

    const animateVolume = (currentTime) => {
        const progress = Math.min((currentTime - startTime) / musicFadeDuration, 1);
        const easedProgress = 1 - Math.pow(1 - progress, 3);

        backgroundMusic.volume = startVolume + (targetVolume - startVolume) * easedProgress;

        if (progress < 1 && fadeToken === musicFadeToken) {
            musicFadeFrame = requestAnimationFrame(animateVolume);
        } else if (progress === 1 && fadeToken === musicFadeToken && onComplete) {
            onComplete();
        }
    };

    musicFadeFrame = requestAnimationFrame(animateVolume);
};

const playMusic = () => {
    if (!backgroundMusic || isMusicMuted) {
        return;
    }

    backgroundMusic.muted = false;

    try {
        backgroundMusic.play().catch(() => {
        });
    } catch (error) {
    }
};

const wakeMusic = () => {
    if (!backgroundMusic || isMusicMuted) {
        return;
    }

    playMusic();

    if (backgroundMusic.volume < userVolume) {
        fadeMusicTo(userVolume);
        window.setTimeout(() => {
            if (!isMusicMuted && backgroundMusic.volume < userVolume) {
                backgroundMusic.volume = userVolume;
            }
        }, musicFadeDuration + 50);
    }
};

const startMusic = () => {
    if (backgroundMusic) {
        restoreMusicPosition();
        backgroundMusic.volume = 0;
        backgroundMusic.muted = isMusicMuted;
        playMusic();
        fadeMusicTo(isMusicMuted ? 0 : userVolume);

        if (!isMusicMuted) {
            window.setTimeout(() => {
                if (!isMusicMuted && backgroundMusic.volume < userVolume) {
                    backgroundMusic.volume = userVolume;
                }
            }, musicFadeDuration + 50);
        }
    }
};

const updateAudioControl = () => {
    if (volumeSlider) {
        volumeSlider.value = userVolume.toString();
    }

    if (audioToggle) {
        audioToggle.setAttribute("aria-pressed", isMusicMuted.toString());
        audioToggle.setAttribute(
            "aria-label",
            isMusicMuted ? "Включить звук" : "Выключить звук"
        );
        audioToggle.querySelector("span").textContent = isMusicMuted ? "🔇" : "🔊";
    }
};

if (audioToggle) {
    audioToggle.addEventListener("click", () => {
        isMusicMuted = !isMusicMuted;
        sessionStorage.setItem(musicMutedKey, isMusicMuted.toString());
        updateAudioControl();

        if (backgroundMusic) {
            if (isMusicMuted) {
                fadeMusicTo(0, () => {
                    backgroundMusic.muted = true;
                });
            } else {
                backgroundMusic.muted = false;
                playMusic();
                fadeMusicTo(userVolume);
                window.setTimeout(() => {
                    if (!isMusicMuted && backgroundMusic.volume < userVolume) {
                        backgroundMusic.volume = userVolume;
                    }
                }, musicFadeDuration + 50);
            }
        }
    });
}

if (volumeSlider) {
    volumeSlider.addEventListener("input", () => {
        userVolume = Number(volumeSlider.value);
        isMusicMuted = userVolume === 0;
        sessionStorage.setItem(musicVolumeKey, userVolume.toString());
        sessionStorage.setItem(musicMutedKey, isMusicMuted.toString());

        if (backgroundMusic) {
            backgroundMusic.muted = false;
            backgroundMusic.volume = userVolume;
            playMusic();
        }

        updateAudioControl();
    });
}

updateAudioControl();

document.addEventListener("pointerdown", wakeMusic, { once: true });
document.addEventListener("keydown", wakeMusic, { once: true });

if (backgroundMusic) {
    backgroundMusic.addEventListener("timeupdate", saveMusicPosition);
    window.addEventListener("pagehide", saveMusicPosition);
    backgroundMusic.addEventListener("loadeddata", wakeMusic);
    backgroundMusic.addEventListener("canplay", wakeMusic);

    document.addEventListener("click", (event) => {
        const link = event.target.closest("a[href]");

        if (!link || link.target === "_blank" || link.origin !== window.location.origin) {
            return;
        }

        const destination = new URL(link.href);

        if (destination.pathname === window.location.pathname && destination.hash) {
            return;
        }

        event.preventDefault();
        saveMusicPosition();
        fadeMusicTo(0, () => {
            window.location.href = link.href;
        });
    });
}

if (entryScreen && entryButton) {
    const enterSite = () => {
        document.body.classList.remove("entry-locked");
        entryScreen.classList.add("is-hidden");
        sessionStorage.setItem(entrySeenKey, "true");
        startMusic();
    };

    const shouldShowEntry = isPageReload || !sessionStorage.getItem(entrySeenKey);

    if (!shouldShowEntry) {
        document.body.classList.remove("entry-locked");
        entryScreen.classList.add("is-hidden");
        startMusic();
    } else {
        entryScreen.addEventListener("click", enterSite, { once: true });

        entryButton.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                enterSite();
            }
        });
    }
} else {
    startMusic();
}


/* =========================
   ЭЛЕМЕНТЫ
========================= */

const glow = document.querySelector(".glow-one");
const particlesContainer = document.querySelector(".particles");
const hero = document.querySelector(".hero");
const heroContent = document.querySelector(".hero-content");
const heroGrid = document.querySelector(".hero-grid");

if (glow && heroContent && heroGrid && hero) {
    /*
       Анимация hero только там, где есть все нужные элементы.
    */


/* =========================
   ПЕРЕМЕННЫЕ МЫШИ
========================= */

let mouseX = window.innerWidth / 2;
let mouseY = window.innerHeight / 2;

let glowX = mouseX;
let glowY = mouseY;

let contentX = 0;
let contentY = 0;

let gridX = 0;
let gridY = 0;


/* =========================
   ДВИЖЕНИЕ МЫШИ
========================= */

document.addEventListener("mousemove", (event) => {

    mouseX = event.clientX;
    mouseY = event.clientY;

});


/* =========================
   АНИМАЦИЯ HERO
========================= */

function animateHero() {

    /*
       Свечение следует за мышью
    */

    glowX += (mouseX - glowX) * 0.055;
    glowY += (mouseY - glowY) * 0.055;

    glow.style.left = `${glowX - 250}px`;
    glow.style.top = `${glowY - 250}px`;


    /*
       Очень лёгкое движение контента
    */

    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;

    const mouseOffsetX = (mouseX - centerX) / centerX;
    const mouseOffsetY = (mouseY - centerY) / centerY;


    contentX +=
        (mouseOffsetX * 7 - contentX) * 0.04;

    contentY +=
        (mouseOffsetY * 5 - contentY) * 0.04;


    heroContent.style.transform =
        `translate3d(${contentX}px, ${contentY}px, 0)`;


    /*
       Сетка двигается ещё слабее
    */

    const targetGridX = mouseOffsetX * 12;
    const targetGridY = mouseOffsetY * 12;

    gridX +=
        (targetGridX - gridX) * 0.03;

    gridY +=
        (targetGridY - gridY) * 0.03;

    heroGrid.style.transform =
        `translate3d(${gridX}px, ${gridY}px, 0)`;


    requestAnimationFrame(animateHero);

}

    animateHero();
}


/* =========================
   ЧАСТИЦЫ
========================= */

if (particlesContainer) {

    for (let i = 0; i < 35; i++) {

        const particle =
            document.createElement("span");

        particle.classList.add("particle");


        /*
           Случайная позиция
        */

        particle.style.left =
            Math.random() * 100 + "%";

        particle.style.top =
            Math.random() * 100 + "%";


        /*
           Случайная задержка
        */

        particle.style.animationDelay =
            Math.random() * 5 + "s";


        /*
           Случайная скорость
        */

        particle.style.animationDuration =
            4 + Math.random() * 6 + "s";


        /*
           Иногда частицы чуть крупнее
        */

        const size =
            Math.random() > 0.8
                ? 3
                : 2;

        particle.style.width =
            size + "px";

        particle.style.height =
            size + "px";


        particlesContainer.appendChild(
            particle
        );

    }

}


/* =========================
   МОБИЛЬНЫЕ УСТРОЙСТВА
========================= */

if (window.matchMedia("(max-width: 800px)").matches) {

    /*
       На телефоне мыши нет,
       поэтому убираем лишнее движение.
    */

    heroContent.style.transform =
        "translate3d(0, 0, 0)";

    heroGrid.style.transform =
        "translate3d(0, 0, 0)";

}

/* =========================
   ПЕРЕВОРЧИВАНИЕ КАРТОЧЕК АРХИВА
========================= */

const flipCards = document.querySelectorAll(".flip-card");

flipCards.forEach((card) => {
    const front = card.querySelector(".flip-card-front");
    const back = card.querySelector(".flip-card-back");
    const oldTitle = back?.querySelector("h3");
    const oldDescription = back?.querySelector("p");
    let siteLink = back?.querySelector(".site-link-button");

    card.classList.add("archive-template-card");

    oldTitle?.remove();
    oldDescription?.remove();

    if (back && !siteLink) {
        siteLink = document.createElement("a");
        siteLink.className = "site-link-button";
        back.appendChild(siteLink);
    }

    if (siteLink) {
        siteLink.target = "_blank";
        siteLink.rel = "noopener noreferrer";
        siteLink.textContent = "ОТКРЫТЬ САЙТ";
    }
});

flipCards.forEach((card) => {
    const toggleFlip = () => {
        card.classList.toggle("is-flipped");
    };

    const handleCardClick = (event) => {
        const redirectUrl = card.dataset.link;

        if (redirectUrl) {
            event.preventDefault();
            window.open(redirectUrl, "_blank", "noopener,noreferrer");
            return;
        }

        toggleFlip();
    };

    card.addEventListener("click", handleCardClick);

    card.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            handleCardClick(event);
        }
    });
});