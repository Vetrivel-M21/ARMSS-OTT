package media

import (
	"bytes"
	"encoding/binary"
	"os"
	"path/filepath"
	"testing"
)

func createFakeAtom(atomType string, size uint32) []byte {
	buf := make([]byte, size)
	binary.BigEndian.PutUint32(buf[0:4], size)
	copy(buf[4:8], []byte(atomType))
	return buf
}

func TestInspectTopLevelAtoms(t *testing.T) {
	var data []byte
	data = append(data, createFakeAtom("ftyp", 16)...)
	data = append(data, createFakeAtom("moov", 32)...)
	data = append(data, createFakeAtom("mdat", 64)...)

	atoms, err := InspectTopLevelAtoms(bytes.NewReader(data))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(atoms) != 3 {
		t.Fatalf("expected 3 atoms, got %d", len(atoms))
	}
	if atoms[0].Type != "ftyp" || atoms[1].Type != "moov" || atoms[2].Type != "mdat" {
		t.Fatalf("atom order mismatch: %+v", atoms)
	}
}

func TestIsFragmentedOrNoFaststart(t *testing.T) {
	tmpDir := t.TempDir()

	// 1. Faststart file: ftyp -> moov -> mdat
	faststartPath := filepath.Join(tmpDir, "faststart.mp4")
	var fData []byte
	fData = append(fData, createFakeAtom("ftyp", 16)...)
	fData = append(fData, createFakeAtom("moov", 32)...)
	fData = append(fData, createFakeAtom("mdat", 64)...)
	if err := os.WriteFile(faststartPath, fData, 0644); err != nil {
		t.Fatal(err)
	}
	if IsFragmentedOrNoFaststart(faststartPath) {
		t.Errorf("faststart MP4 should not need normalization")
	}

	// 2. No faststart file: ftyp -> mdat -> moov (moov at end)
	noFaststartPath := filepath.Join(tmpDir, "nofaststart.mp4")
	var nfData []byte
	nfData = append(nfData, createFakeAtom("ftyp", 16)...)
	nfData = append(nfData, createFakeAtom("mdat", 64)...)
	nfData = append(nfData, createFakeAtom("moov", 32)...)
	if err := os.WriteFile(noFaststartPath, nfData, 0644); err != nil {
		t.Fatal(err)
	}
	if !IsFragmentedOrNoFaststart(noFaststartPath) {
		t.Errorf("moov at end should need normalization")
	}

	// 3. Fragmented file: ftyp -> moov -> moof -> mdat
	fragmentedPath := filepath.Join(tmpDir, "frag.mp4")
	var fragData []byte
	fragData = append(fragData, createFakeAtom("ftyp", 16)...)
	fragData = append(fragData, createFakeAtom("moov", 32)...)
	fragData = append(fragData, createFakeAtom("moof", 40)...)
	fragData = append(fragData, createFakeAtom("mdat", 64)...)
	if err := os.WriteFile(fragmentedPath, fragData, 0644); err != nil {
		t.Fatal(err)
	}
	if !IsFragmentedOrNoFaststart(fragmentedPath) {
		t.Errorf("fragmented MP4 (with moof) should need normalization")
	}
}
