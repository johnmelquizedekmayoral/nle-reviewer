-- Expand the allowed appearance themes.

alter table public.user_preferences
  drop constraint if exists user_preferences_theme_check;

alter table public.user_preferences
  add constraint user_preferences_theme_check
  check (
    theme in (
      'light',
      'dark',
      'system',
      'midnight',
      'ocean',
      'forest',
      'warm',
      'retro',
      'terminal',
      'synthwave'
    )
  );

