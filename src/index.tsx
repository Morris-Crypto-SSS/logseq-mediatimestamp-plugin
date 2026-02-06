import '@logseq/libs'

import { getFloatingVideo, initFloatingPlayer, returnFloatingVideo, updateFloatingPlayerSettings } from './floatingPlayer'
import { settings } from './settings'

const main = async () => {
  await logseq.UI.showMsg('logseq-mediatimestamp-plugin loaded')

  const getVideoEl = async (uuid: string): Promise<HTMLVideoElement | null> => {
    const blk = await logseq.Editor.getBlock(uuid)
    if (!blk) {
      console.warn('[mediatimestamp] Current block not found', uuid)
      return null
    }

    // Helper to query video in a specific block
    const findVideoInBlock = (blockUuid: string) => {
      let el: HTMLVideoElement | null = null
      const container = top?.document.getElementById(`ls-block-${blockUuid}`) ||
        top?.document.querySelector(`div[blockid="${blockUuid}"]`)

      if (container) {
        el = container.querySelector('video')
      }
      return el
    }

    // Helper to check if a block has a placeholder (meaning its video is floating)
    const hasPlaceholder = (blockUuid: string) => {
      const container = top?.document.getElementById(`ls-block-${blockUuid}`) ||
        top?.document.querySelector(`div[blockid="${blockUuid}"]`)
      if (container) {
        return container.querySelector('.mediatimestamp-video-placeholder') !== null
      }
      return false
    }

    // Check if ANY of the related blocks has the floating video
    const blocksToCheck = [blk.uuid]
    if (blk.left) {
      const leftId = (blk.left as any).id || blk.left
      const leftBlk = await logseq.Editor.getBlock(leftId)
      if (leftBlk) blocksToCheck.push(leftBlk.uuid)
    }
    if (blk.parent) {
      const parentId = (blk.parent as any).id || blk.parent
      const parentBlk = await logseq.Editor.getBlock(parentId)
      if (parentBlk) blocksToCheck.push(parentBlk.uuid)
    }

    // Check if the floating video belongs to any of the related blocks
    const floatingVideo = getFloatingVideo()
    if (floatingVideo) {
      for (const blockUuid of blocksToCheck) {
        if (hasPlaceholder(blockUuid)) {
          // The floating video is from one of the related blocks - return it
          return floatingVideo
        }
      }
      // If we get here, the floating video is from a DIFFERENT block
      // Return it to its original position first
      returnFloatingVideo()
    }

    // Now search for the video in the regular way
    // 1. Check current block
    let videoEl = findVideoInBlock(blk.uuid)
    if (videoEl) return videoEl

    // 2. Check previous sibling block
    if (blk.left) {
      try {
        const leftId = (blk.left as any).id || blk.left
        const leftBlk = await logseq.Editor.getBlock(leftId)
        if (leftBlk) {
          videoEl = findVideoInBlock(leftBlk.uuid)
          if (videoEl) return videoEl
        }
      } catch (e) {
        console.error('[mediatimestamp] Error checking left sibling', e)
      }
    }

    // 3. Check parent block
    if (blk.parent) {
      try {
        const parentId = (blk.parent as any).id || blk.parent
        const parentBlk = await logseq.Editor.getBlock(parentId)
        if (parentBlk) {
          videoEl = findVideoInBlock(parentBlk.uuid)
          if (videoEl) return videoEl
        }
      } catch (e) {
        console.error('[mediatimestamp] Error checking parent block', e)
      }
    }

    return null
  }


  await logseq.Editor.registerSlashCommand(
    'Insert timestamp',
    async ({ uuid }) => {
      try {
        const videoEl = await getVideoEl(uuid)
        if (!videoEl) {
          await logseq.UI.showMsg('No video found in current, sibling or parent block', 'warning')
          return
        }
        await logseq.Editor.insertAtEditingCursor(
          `{{renderer :mediatimestamp_${uuid}, ${videoEl.currentTime}}}`,
        )
      } catch (e) {
        console.error('[mediatimestamp] Error in slash command', e)
        await logseq.UI.showMsg('Error inserting timestamp. Check console.', 'error')
      }
    },
  )

  logseq.provideStyle(`
    .logseq-mediatimestamp-plugin {
      border: 1px solid; 
      padding: 0 10px;
      border-radius: 6px;
    }

    /* Floating Video Player Container */
    .mediatimestamp-floating-player {
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 9999;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      overflow: hidden;
      background: #000;
      transition: opacity 0.3s ease, transform 0.3s ease;
    }

    /* Drag Handle (header area) */
    .mediatimestamp-floating-player .drag-handle {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 24px;
      cursor: move;
      background: linear-gradient(to bottom, rgba(0,0,0,0.5), transparent);
      z-index: 10;
    }

    /* Close Button - hidden by default */
    .mediatimestamp-floating-player .close-btn {
      position: absolute;
      top: 4px;
      right: 8px;
      width: 20px;
      height: 20px;
      border: none;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.2);
      color: #fff;
      cursor: pointer;
      opacity: 0;
      transition: opacity 0.2s ease, background 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      z-index: 11;
    }

    /* Show close button on hover */
    .mediatimestamp-floating-player:hover .close-btn {
      opacity: 1;
    }

    .mediatimestamp-floating-player .close-btn:hover {
      background: rgba(255, 80, 80, 0.8);
    }

    /* Video inside floating player */
    .mediatimestamp-floating-player video {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
  `)

  logseq.App.onMacroRendererSlotted(
    async ({ slot, payload: { uuid, arguments: args } }) => {
      const [type, time] = args

      if (!type || !type.startsWith(':mediatimestamp_')) return

      const id = `mediatimestamp_${uuid}_${slot}`
      const clickHandlerId = `mediaclick_${uuid}_${slot}`

      logseq.provideModel({
        async [clickHandlerId]() {
          const videoEl = await getVideoEl(uuid)
          if (!videoEl || !time) {
            await logseq.UI.showMsg(
              'Unable to get obtain video element',
              'error',
            )
          } else {
            videoEl.currentTime = parseInt(time) || 0
            videoEl.play()
          }
        },
      })

      if (time) {
        logseq.provideUI({
          key: id,
          slot,
          reset: true,
          template: `<button id="${id}" class="logseq-mediatimestamp-plugin" data-on-click="${clickHandlerId}">Timestamp: ${parseInt(time)}s</button>`,
        })
      }
    },
  )

  // Initialize floating player with settings
  const floatingPlayerEnabled = logseq.settings?.floatingPlayerEnabled === true || logseq.settings?.floatingPlayerEnabled === undefined
  const floatingPlayerSize = (logseq.settings?.floatingPlayerSize as 'small' | 'medium' | 'large' | 'xlarge' | 'xxlarge' | 'xxxlarge') ?? 'medium'

  initFloatingPlayer({
    enabled: floatingPlayerEnabled,
    size: floatingPlayerSize,
  })

  // Listen for settings changes
  logseq.onSettingsChanged((newSettings) => {
    updateFloatingPlayerSettings({
      enabled: newSettings.floatingPlayerEnabled ?? true,
      size: (newSettings.floatingPlayerSize as 'small' | 'medium' | 'large' | 'xlarge' | 'xxlarge' | 'xxxlarge') ?? 'medium',
    })
  })
}

logseq.useSettingsSchema(settings).ready(main).catch(console.error)
