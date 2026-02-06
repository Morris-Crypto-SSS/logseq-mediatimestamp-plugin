import { SettingSchemaDesc } from '@logseq/libs/dist/LSPlugin.user'

export const settings: SettingSchemaDesc[] = [
  {
    key: 'floatingPlayerEnabled',
    type: 'boolean',
    default: true,
    title: 'Enable Floating Player',
    description: 'Show a floating mini-player when you scroll away from a playing video.',
  },
  {
    key: 'floatingPlayerSize',
    type: 'enum',
    default: 'medium',
    title: 'Floating Player Size',
    description: 'Size of the floating video player.',
    enumChoices: ['small', 'medium', 'large', 'xlarge', 'xxlarge', 'xxxlarge'],
    enumPicker: 'select',
  },
]
