package proxy

import "github.com/pobradovic08/kormos/backend/internal/normalize"

func parseBool(s string) bool    { return normalize.ParseBool(s) }
func parseInt(s string) int      { return normalize.ParseInt(s) }
func parseInt64(s string) int64  { return normalize.ParseInt64(s) }
func splitCSV(s string) []string { return normalize.SplitCSV(s) }
