const FeatureMondai = require('../src/features/mondai')
const FeatureSimpleReply = require('../src/features/simple-reply')
const FeatureCustomReply = require('../src/features/custom-reply')

module.exports = new Map([
	['simpleReply', new FeatureSimpleReply()],
	['customReply', new FeatureCustomReply('res')]
])
