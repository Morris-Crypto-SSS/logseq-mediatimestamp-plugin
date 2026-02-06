/**
 * Floating Video Player (Picture-in-Picture) Module
 * 
 * Provides a floating mini-player that appears when the user scrolls away
 * from the currently playing video, allowing continued viewing while taking notes.
 * 
 * This version MOVES the original video element to the floating container
 * instead of cloning it, ensuring perfect sync with timestamps.
 */

interface FloatingPlayerSettings {
    enabled: boolean
    size: 'small' | 'medium' | 'large' | 'xlarge' | 'xxlarge' | 'xxxlarge'
}

interface Position {
    x: number
    y: number
}

interface VideoState {
    video: HTMLVideoElement
    originalParent: HTMLElement
    originalNextSibling: Node | null
    placeholder: HTMLDivElement
}

const SIZE_MAP = {
    small: { width: 240, height: 135 },
    medium: { width: 320, height: 180 },
    large: { width: 400, height: 225 },
    xlarge: { width: 480, height: 270 },
    xxlarge: { width: 640, height: 360 },
    xxxlarge: { width: 800, height: 450 },
}

// State
let recentlyPlayedVideo: HTMLVideoElement | null = null
let floatingContainer: HTMLDivElement | null = null
let observer: IntersectionObserver | null = null
let isManuallyHidden = false
let isDragging = false
let dragOffset: Position = { x: 0, y: 0 }
let currentSettings: FloatingPlayerSettings = { enabled: true, size: 'medium' }
let videoState: VideoState | null = null
let isFloating = false

/**
 * Creates the floating player container element
 */
const createFloatingContainer = (doc: Document): HTMLDivElement => {
    const container = doc.createElement('div')
    container.className = 'mediatimestamp-floating-player'
    container.style.display = 'none'

    // Drag handle
    const dragHandle = doc.createElement('div')
    dragHandle.className = 'drag-handle'
    container.appendChild(dragHandle)

    // Close button
    const closeBtn = doc.createElement('button')
    closeBtn.className = 'close-btn'
    closeBtn.innerHTML = '✕'
    closeBtn.title = 'Close floating player'
    closeBtn.addEventListener('click', (e) => {
        e.stopPropagation()
        hideFloatingPlayer()
        isManuallyHidden = true
    })
    container.appendChild(closeBtn)

    // Drag functionality
    dragHandle.addEventListener('mousedown', startDrag)

    return container
}

// Store the document reference for drag operations
let dragDoc: Document | null = null

/**
 * Start dragging the floating player
 */
const startDrag = (e: MouseEvent) => {
    if (!floatingContainer) return

    isDragging = true
    dragDoc = top?.document || document

    const rect = floatingContainer.getBoundingClientRect()
    dragOffset = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
    }

    dragDoc.addEventListener('mousemove', onDrag)
    dragDoc.addEventListener('mouseup', stopDrag)

    // Prevent text selection during drag
    e.preventDefault()
    e.stopPropagation()
}

/**
 * Handle drag movement
 */
const onDrag = (e: MouseEvent) => {
    if (!isDragging || !floatingContainer) return

    const size = SIZE_MAP[currentSettings.size]

    // Use the correct window context for viewport dimensions
    const win = top?.window || window
    const viewportWidth = win.innerWidth
    const viewportHeight = win.innerHeight

    // Calculate new position based on mouse position
    let newX = e.clientX - dragOffset.x
    let newY = e.clientY - dragOffset.y

    // Constrain to viewport with some padding
    newX = Math.max(10, Math.min(newX, viewportWidth - size.width - 10))
    newY = Math.max(10, Math.min(newY, viewportHeight - size.height - 10))

    // Apply position using left/top (clearing right/bottom)
    floatingContainer.style.right = 'auto'
    floatingContainer.style.bottom = 'auto'
    floatingContainer.style.left = `${newX}px`
    floatingContainer.style.top = `${newY}px`

    e.preventDefault()
}

/**
 * Stop dragging
 */
const stopDrag = (e?: MouseEvent) => {
    isDragging = false
    if (dragDoc) {
        dragDoc.removeEventListener('mousemove', onDrag)
        dragDoc.removeEventListener('mouseup', stopDrag)
        dragDoc = null
    }
    e?.preventDefault()
}

/**
 * Show the floating player by MOVING the original video into it
 */
const showFloatingPlayer = () => {
    if (!recentlyPlayedVideo || !floatingContainer || !currentSettings.enabled || isManuallyHidden || isFloating) {
        return
    }

    const video = recentlyPlayedVideo
    const parent = video.parentElement

    if (!parent) return

    const doc = top?.document || document

    // Store the original position
    videoState = {
        video: video,
        originalParent: parent,
        originalNextSibling: video.nextSibling,
        placeholder: doc.createElement('div')
    }

    // Create placeholder to maintain layout
    videoState.placeholder.className = 'mediatimestamp-video-placeholder'
    videoState.placeholder.style.width = `${video.offsetWidth}px`
    videoState.placeholder.style.height = `${video.offsetHeight}px`
    videoState.placeholder.style.background = 'rgba(0,0,0,0.1)'
    videoState.placeholder.style.borderRadius = '8px'
    videoState.placeholder.style.display = 'flex'
    videoState.placeholder.style.alignItems = 'center'
    videoState.placeholder.style.justifyContent = 'center'
    videoState.placeholder.innerHTML = '<span style="color: #666; font-size: 14px;">📺 Video in mini player</span>'

    // Insert placeholder where video was
    parent.insertBefore(videoState.placeholder, video)

    // Store original video styles
    const originalWidth = video.style.width
    const originalHeight = video.style.height
        ; (video as any)._originalStyles = { width: originalWidth, height: originalHeight }

    // Move video to floating container
    const size = SIZE_MAP[currentSettings.size]
    floatingContainer.style.width = `${size.width}px`
    floatingContainer.style.height = `${size.height}px`

    video.style.width = '100%'
    video.style.height = '100%'
    floatingContainer.appendChild(video)
    floatingContainer.style.display = 'block'

    isFloating = true
}

/**
 * Hide the floating player and return the video to its original position
 */
const hideFloatingPlayer = () => {
    if (!floatingContainer || !isFloating || !videoState) return

    const { video, originalParent, originalNextSibling, placeholder } = videoState

    // Restore original styles
    if ((video as any)._originalStyles) {
        video.style.width = (video as any)._originalStyles.width
        video.style.height = (video as any)._originalStyles.height
        delete (video as any)._originalStyles
    }

    // Move video back to original position
    if (originalNextSibling && originalNextSibling.parentNode === originalParent) {
        originalParent.insertBefore(video, originalNextSibling)
    } else {
        originalParent.appendChild(video)
    }

    // Remove placeholder
    if (placeholder.parentElement) {
        placeholder.parentElement.removeChild(placeholder)
    }

    // Hide container and reset position
    floatingContainer.style.display = 'none'
    floatingContainer.style.left = ''
    floatingContainer.style.top = ''
    floatingContainer.style.right = '20px'
    floatingContainer.style.bottom = '20px'

    videoState = null
    isFloating = false
}

/**
 * Handle video play event to track recently played video
 */
const handleVideoPlay = (e: Event) => {
    const video = e.target as HTMLVideoElement
    if (video && video.tagName === 'VIDEO') {
        // If switching to a different video, reset manual hide state
        if (recentlyPlayedVideo !== video) {
            isManuallyHidden = false

            // If previous video was floating, return it first
            if (isFloating && videoState && videoState.video !== video) {
                hideFloatingPlayer()
            }
        }

        recentlyPlayedVideo = video

        // Update observer to watch this video (or its placeholder when floating)
        if (observer) {
            observer.disconnect()

            // We need to observe the placeholder when floating, or the video when not
            const targetToObserve = isFloating && videoState?.placeholder ? videoState.placeholder : video
            observer.observe(targetToObserve)
        }
    }
}

/**
 * IntersectionObserver callback
 */
const handleIntersection: IntersectionObserverCallback = (entries) => {
    entries.forEach(entry => {
        // When floating, we observe the placeholder; when not, we observe the video
        const isTargetValid = isFloating
            ? entry.target === videoState?.placeholder
            : entry.target === recentlyPlayedVideo

        if (isTargetValid) {
            if (!entry.isIntersecting && !isFloating) {
                // Video/placeholder scrolled out of view - show floating player
                showFloatingPlayer()

                // Re-observe the placeholder now
                if (observer && videoState?.placeholder) {
                    observer.disconnect()
                    observer.observe(videoState.placeholder)
                }
            } else if (entry.isIntersecting && isFloating) {
                // Placeholder back in view - hide floating player
                hideFloatingPlayer()
                isManuallyHidden = false

                // Re-observe the video now
                if (observer && recentlyPlayedVideo) {
                    observer.disconnect()
                    observer.observe(recentlyPlayedVideo)
                }
            }
        }
    })
}

/**
 * Initialize the floating player system
 */
export const initFloatingPlayer = (settings: FloatingPlayerSettings) => {
    currentSettings = settings

    if (!settings.enabled) {
        return
    }

    // Get the top document (Logseq's main document)
    const doc = top?.document || document

    // Create floating container if not exists
    if (!floatingContainer) {
        floatingContainer = createFloatingContainer(doc)
        doc.body.appendChild(floatingContainer)
    }

    // Create IntersectionObserver
    observer = new IntersectionObserver(handleIntersection, {
        threshold: 0.1,
        root: null // viewport
    })

    // Listen for video play events (using capture to catch all videos)
    doc.addEventListener('play', handleVideoPlay, true)

    // Also observe any existing videos
    const existingVideos = doc.querySelectorAll('video')
    existingVideos.forEach(video => {
        // If a video is already playing, track it
        if (!video.paused) {
            recentlyPlayedVideo = video
            observer?.observe(video)
        }
    })
}

/**
 * Update settings at runtime
 */
export const updateFloatingPlayerSettings = (settings: FloatingPlayerSettings) => {
    currentSettings = settings

    if (!settings.enabled && floatingContainer) {
        hideFloatingPlayer()
    }

    // Update size if container exists and is visible
    if (floatingContainer && floatingContainer.style.display !== 'none') {
        const size = SIZE_MAP[settings.size]
        floatingContainer.style.width = `${size.width}px`
        floatingContainer.style.height = `${size.height}px`
    }
}

/**
 * Cleanup the floating player system
 */
export const destroyFloatingPlayer = () => {
    const doc = top?.document || document

    // Return video to original position if floating
    hideFloatingPlayer()

    // Remove event listeners
    doc.removeEventListener('play', handleVideoPlay, true)

    // Disconnect observer
    if (observer) {
        observer.disconnect()
        observer = null
    }

    // Remove floating container
    if (floatingContainer) {
        floatingContainer.remove()
        floatingContainer = null
    }

    recentlyPlayedVideo = null
    isManuallyHidden = false
    isFloating = false
    videoState = null
}

/**
 * Get the currently floating video element, if any
 * This allows other parts of the plugin to access the video when it's in floating mode
 */
export const getFloatingVideo = (): HTMLVideoElement | null => {
    if (isFloating && videoState) {
        return videoState.video
    }
    return null
}

/**
 * Return the floating video to its original position
 * Call this when switching to a different video
 * @param pauseVideo - if true, pause the video when returning it (default: true)
 */
export const returnFloatingVideo = (pauseVideo = true): void => {
    if (isFloating && videoState) {
        if (pauseVideo) {
            videoState.video.pause()
        }
        hideFloatingPlayer()
    }
}
