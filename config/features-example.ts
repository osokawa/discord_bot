import { FeatureInterface } from '../src/features/feature'
import { FeatureSimpleReply } from '../src/features/simple-reply'
import { FeatureCustomReply } from '../src/features/custom-reply'

const features: Map<string, FeatureInterface> = new Map()

features.set('simpleReply', new FeatureSimpleReply())
features.set('customReply', new FeatureCustomReply('res'))

export default features
