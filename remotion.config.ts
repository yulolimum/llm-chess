import { Config } from '@remotion/cli/config'
import { enableTailwind } from '@remotion/tailwind-v4'

Config.overrideWebpackConfig(currentConfiguration =>
  enableTailwind({
    ...currentConfiguration,
    resolve: {
      ...currentConfiguration.resolve,
      extensionAlias: {
        ...currentConfiguration.resolve?.extensionAlias,
        '.js': ['.js', '.ts', '.tsx'],
      },
      extensions: [...(currentConfiguration.resolve?.extensions ?? []), '.ts', '.tsx'],
    },
  }),
)
