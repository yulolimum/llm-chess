import { Config } from '@remotion/cli/config'

Config.overrideWebpackConfig(currentConfiguration => ({
  ...currentConfiguration,
  resolve: {
    ...currentConfiguration.resolve,
    extensionAlias: {
      ...currentConfiguration.resolve?.extensionAlias,
      '.js': ['.js', '.ts', '.tsx'],
    },
    extensions: [...(currentConfiguration.resolve?.extensions ?? []), '.ts', '.tsx'],
  },
}))
