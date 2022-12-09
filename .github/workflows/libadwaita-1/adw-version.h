/*
 * Copyright (C) 2017 Purism SPC
 *
 * SPDX-License-Identifier: LGPL-2.1-or-later
 */

#pragma once

#if !defined(_ADWAITA_INSIDE) && !defined(ADWAITA_COMPILATION)
#error "Only <adwaita.h> can be included directly."
#endif

#include <glib.h>

G_BEGIN_DECLS

/**
 * ADW_MAJOR_VERSION:
 *
 * Adwaita major version component (e.g. 1 if the version is 1.2.3).
 */
#define ADW_MAJOR_VERSION              (1)

/**
 * ADW_MINOR_VERSION:
 *
 * Adwaita minor version component (e.g. 2 if the version is 1.2.3).
 */
#define ADW_MINOR_VERSION              (2)

/**
 * ADW_MICRO_VERSION:
 *
 * Adwaita micro version component (e.g. 3 if the version is 1.2.3).
 */
#define ADW_MICRO_VERSION              (0)

/**
 * ADW_VERSION:
 *
 * Adwaita version (e.g. 1.2.3).
 */
#define ADW_VERSION                    (1.2.0)

/**
 * ADW_VERSION_S:
 *
 * Adwaita version, encoded as a string, useful for printing and
 * concatenation.
 */
#define ADW_VERSION_S                  "1.2.0"

#define ADW_ENCODE_VERSION(major,minor,micro) \
        ((major) << 24 | (minor) << 16 | (micro) << 8)

/**
 * ADW_VERSION_HEX:
 *
 * Adwaita version, encoded as an hexadecimal number, useful for
 * integer comparisons.
 */
#define ADW_VERSION_HEX \
        (ADW_ENCODE_VERSION (ADW_MAJOR_VERSION, ADW_MINOR_VERSION, ADW_MICRO_VERSION))

/**
 * ADW_CHECK_VERSION:
 * @major: required major version
 * @minor: required minor version
 * @micro: required micro version
 *
 * Compile-time version checking. Evaluates to `TRUE` if the version
 * of Adwaita is greater than the required one.
 */
#define ADW_CHECK_VERSION(major,minor,micro)   \
        (ADW_MAJOR_VERSION > (major) || \
         (ADW_MAJOR_VERSION == (major) && ADW_MINOR_VERSION > (minor)) || \
         (ADW_MAJOR_VERSION == (major) && ADW_MINOR_VERSION == (minor) && \
          ADW_MICRO_VERSION >= (micro)))

/**
 * ADW_VERSION_1_1:
 *
 * A macro that evaluates to the 1.2 version of Adwaita, in a format
 * that can be used by the C pre-processor.
 *
 * Since: 1.1
 */
#define ADW_VERSION_1_1 (ADW_ENCODE_VERSION (1, 1, 0))

/**
 * ADW_VERSION_1_2:
 *
 * A macro that evaluates to the 1.2 version of Adwaita, in a format
 * that can be used by the C pre-processor.
 *
 * Since: 1.2
 */
#define ADW_VERSION_1_2 (ADW_ENCODE_VERSION (1, 2, 0))

#ifndef _ADW_EXTERN
#define _ADW_EXTERN extern
#endif

#ifndef ADW_VERSION_MAX_ALLOWED
# define ADW_VERSION_MAX_ALLOWED ADW_VERSION_1_2
#endif

#ifndef ADW_VERSION_MIN_REQUIRED
# define ADW_VERSION_MIN_REQUIRED ADW_VERSION_1_2
#endif

#if ADW_VERSION_MAX_ALLOWED < ADW_VERSION_1_1
# define ADW_AVAILABLE_IN_1_1 ADW_UNAVAILABLE(1, 1)
#else
# define ADW_AVAILABLE_IN_1_1 _ADW_EXTERN
#endif

#if ADW_VERSION_MIN_REQUIRED >= ADW_VERSION_1_1
# define ADW_DEPRECATED_IN_1_1             _ADW_DEPRECATED
# define ADW_DEPRECATED_IN_1_1_FOR(f)      _ADW_DEPRECATED_FOR(f)
# define ADW_DEPRECATED_TYPE_IN_1_1        _ADW_DEPRECATED_TYPE
# define ADW_DEPRECATED_TYPE_IN_1_1_FOR(f) _ADW_DEPRECATED_TYPE_FOR(f)
#else
# define ADW_DEPRECATED_IN_1_1             _ADW_EXTERN
# define ADW_DEPRECATED_IN_1_1_FOR(f)      _ADW_EXTERN
# define ADW_DEPRECATED_TYPE_IN_1_1
# define ADW_DEPRECATED_TYPE_IN_1_1_FOR(f)
#endif

#if ADW_VERSION_MAX_ALLOWED < ADW_VERSION_1_2
# define ADW_AVAILABLE_IN_1_2 ADW_UNAVAILABLE(1, 2)
#else
# define ADW_AVAILABLE_IN_1_2 _ADW_EXTERN
#endif

#if ADW_VERSION_MIN_REQUIRED >= ADW_VERSION_1_2
# define ADW_DEPRECATED_IN_1_2             _ADW_DEPRECATED
# define ADW_DEPRECATED_IN_1_2_FOR(f)      _ADW_DEPRECATED_FOR(f)
# define ADW_DEPRECATED_TYPE_IN_1_2        _ADW_DEPRECATED_TYPE
# define ADW_DEPRECATED_TYPE_IN_1_2_FOR(f) _ADW_DEPRECATED_TYPE_FOR(f)
#else
# define ADW_DEPRECATED_IN_1_2             _ADW_EXTERN
# define ADW_DEPRECATED_IN_1_2_FOR(f)      _ADW_EXTERN
# define ADW_DEPRECATED_TYPE_IN_1_2
# define ADW_DEPRECATED_TYPE_IN_1_2_FOR(f)
#endif

#define ADW_UNAVAILABLE(major, minor) G_UNAVAILABLE(major, minor) _ADW_EXTERN

#define ADW_AVAILABLE_IN_ALL _ADW_EXTERN

ADW_AVAILABLE_IN_ALL
guint adw_get_major_version (void) G_GNUC_CONST;
ADW_AVAILABLE_IN_ALL
guint adw_get_minor_version (void) G_GNUC_CONST;
ADW_AVAILABLE_IN_ALL
guint adw_get_micro_version (void) G_GNUC_CONST;

G_END_DECLS