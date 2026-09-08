"""Merge road extracts by OSM type, ID and version (requires pyosmium).

The Swiss input should first be filtered with pfaedle -X for the full PostBus
feed. Raw extracts stay outside the application; only derived paths ship.
"""
import argparse
import osmium

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--switzerland', required=True)
parser.add_argument('--border', required=True)
parser.add_argument('--output', required=True)
args = parser.parse_args()

merge = osmium.MergeInputReader()
merge.add_file(args.switzerland)
merge.add_file(args.border)
writer = osmium.SimpleWriter(args.output)


class Writer(osmium.SimpleHandler):
    def node(self, entity):
        writer.add_node(entity)

    def way(self, entity):
        writer.add_way(entity)

    def relation(self, entity):
        writer.add_relation(entity)


try:
    merge.apply(Writer())
finally:
    writer.close()
