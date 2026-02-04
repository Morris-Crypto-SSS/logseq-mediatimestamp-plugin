import '@logseq/libs'

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

    // 1. Check current block
    let videoEl = findVideoInBlock(blk.uuid)
    if (videoEl) return videoEl

    // 2. Check previous sibling block
    if (blk.left) {
      try {
        // blk.left might be an object {id: number} or an ID

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
        // blk.parent might be an object {id: number} or an ID

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
}

logseq.useSettingsSchema(settings).ready(main).catch(console.error)
