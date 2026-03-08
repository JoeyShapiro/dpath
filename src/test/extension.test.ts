import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as vscode from 'vscode';
import { DeepPath, XmlTag } from '../dpath';

// Helper function to create temporary test files
function createTempXmlFile(content: string): string {
	const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dpath-test-'));
	const filepath = path.join(tempDir, 'test.xml');
	fs.writeFileSync(filepath, content);
	return filepath;
}

// Helper function to clean up temporary files
function cleanupTempFile(filepath: string): void {
	if (fs.existsSync(filepath)) {
		fs.unlinkSync(filepath);
		const dir = path.dirname(filepath);
		if (fs.existsSync(dir)) {
			fs.rmdirSync(dir);
		}
	}
}

suite('dpath Extension Tests', () => {
	vscode.window.showInformationMessage('Starting dpath tests.');

	// Tests for comment handling
	suite('Comment Handling', () => {
		test('should ignore tags inside single-line comments', () => {
			const xml = `<?xml version="1.0"?>
<root>
	<!-- <ignored>tag inside comment</ignored> -->
	<valid>content</valid>
</root>`;
			const filepath = createTempXmlFile(xml);
			try {
				const result = XmlTag(filepath, 4, 16);
				// root should be at line 2, valid should be at line 4
				assert.strictEqual(result.length, 2, 'Expected only root and valid tags to be parsed');
				assert.strictEqual(result[0][0], 'root');
				assert.strictEqual(result[0][1], 2, 'Expected root tag to be on line 2');
				assert.strictEqual(result[1][0], 'valid');
				assert.strictEqual(result[1][1], 4, 'Expected valid tag to be on line 4');
			} finally {
				cleanupTempFile(filepath);
			}
		});

		test('should ignore tags inside multi-line comments', () => {
			const xml = `<?xml version="1.0"?>
<root>
	<!--
	<ignored>tag on line 4</ignored>
	<also_ignored>another tag</also_ignored>
	-->
	<valid>content</valid>
</root>`;
			const filepath = createTempXmlFile(xml);
			try {
				const result = XmlTag(filepath, 7, 16);
				// Only root and valid should be present
				const validTags = result.filter((tag: [string, number]) => tag[0] !== '!--');
				assert.strictEqual(validTags.length, 2, 'Expected only root and valid tags to be parsed');
				assert.strictEqual(validTags[0][0], 'root');
				assert.strictEqual(validTags[1][0], 'valid');
				assert.strictEqual(validTags[1][1], 7, 'Expected valid tag to be on line 7');
			} finally {
				cleanupTempFile(filepath);
			}
		});

		test('should handle multiple comments in sequence', () => {
			const xml = `<?xml version="1.0"?>
<!-- First comment -->
<root>
	<!-- Second comment with <fake>tag</fake> -->
	<real>value</real>
	<!-- Third comment -->
</root>`;
			const filepath = createTempXmlFile(xml);
			try {
				const result = XmlTag(filepath, 5, 14);
				const validTags = result.filter((tag: [string, number]) => tag[0] !== '!--');
				assert.strictEqual(validTags.length, 2, 'Expected only root and real tags to be parsed');
				assert.strictEqual(validTags[0][0], 'root');
				assert.strictEqual(validTags[1][0], 'real');
			} finally {
				cleanupTempFile(filepath);
			}
		});

		test('should not confuse comment markers inside tag attributes', () => {
			const xml = `<?xml version="1.0"?>
<root attr="<!-- not a comment -->">
	<child>content</child>
</root>`;
			const filepath = createTempXmlFile(xml);
			try {
				const result = XmlTag(filepath, 3, 14);
				// Root and child should both be parsed
				assert.ok(result.length >= 2, 'Expected at least 2 valid tags to be parsed');
				assert.strictEqual(result[0][0], 'root');
				assert.strictEqual(result[1][0], 'child');
			} finally {
				cleanupTempFile(filepath);
			}
		});

		test('should not end comment on standalone greater-than character', () => {
			const xml = `<?xml version="1.0"?>
<root>
	<!-- comment with random > symbol and <fake>tag</fake> still inside comment -->
	<real>content</real>
</root>`;
			const filepath = createTempXmlFile(xml);
			try {
				const result = XmlTag(filepath, 4, 16);
				const validTags = result.filter((tag: [string, number]) => tag[0] !== '!--');
				assert.ok(validTags.some((tag: [string, number]) => tag[0] === 'root'));
				assert.ok(validTags.some((tag: [string, number]) => tag[0] === 'real'));
				assert.ok(!validTags.some((tag: [string, number]) => tag[0] === 'fake'));
			} finally {
				cleanupTempFile(filepath);
			}
		});
	});

	// Tests for basic tag parsing
	suite('Basic Tag Parsing', () => {
		test('should parse simple nested tags', () => {
			const xml = `<?xml version="1.0"?>
<root>
	<parent>
		<child>content</child>
	</parent>
</root>`;
			const filepath = createTempXmlFile(xml);
			try {
				const result = XmlTag(filepath, 4, 19);
				assert.ok(result.length > 0);
				assert.strictEqual(result[0][0], 'root');
				assert.ok(result.some((tag: [string, number]) => tag[0] === 'parent'));
				assert.ok(result.some((tag: [string, number]) => tag[0] === 'child'));
				// Check line numbers
				const rootTag = result.find((tag: [string, number]) => tag[0] === 'root');
				const parentTag = result.find((tag: [string, number]) => tag[0] === 'parent');
				const childTag = result.find((tag: [string, number]) => tag[0] === 'child');
				assert.strictEqual(rootTag?.[1], 2, 'Expected root tag to be on line 2');
				assert.strictEqual(parentTag?.[1], 3, 'Expected parent tag to be on line 3');
				assert.strictEqual(childTag?.[1], 4, 'Expected child tag to be on line 4');
			} finally {
				cleanupTempFile(filepath);
			}
		});

		test('should handle tags with attributes', () => {
			const xml = `<?xml version="1.0"?>
<root attr1="value1" attr2="value2">
	<child attr="value">text</child>
</root>`;
			const filepath = createTempXmlFile(xml);
			try {
				const result = XmlTag(filepath, 3, 28);
				assert.strictEqual(result[0][0], 'root');
				assert.ok(result.some((tag: [string, number]) => tag[0] === 'child'));
			} finally {
				cleanupTempFile(filepath);
			}
		});

		test('should handle self-closing tags', () => {
			const xml = `<?xml version="1.0"?>
<root>
	<self-closing/>
	<normal>content</normal>
</root>`;
			const filepath = createTempXmlFile(xml);
			try {
				let result = XmlTag(filepath, 3, 16);
				assert.ok(result.some((tag: [string, number]) => tag[0] === 'root'));
				assert.ok(result.some((tag: [string, number]) => tag[0] === 'self-closing'));

				result = XmlTag(filepath, 4, 16);
				assert.ok(result.some((tag: [string, number]) => tag[0] === 'root'));
				assert.ok(result.some((tag: [string, number]) => tag[0] === 'normal'));
			} finally {
				cleanupTempFile(filepath);
			}
		});

		test('should parse tags with newlines in attributes', () => {
			const xml = `<?xml version="1.0"?>
<root
	attr1="value1"
	attr2="value2">
	<child>content</child>
</root>`;
			const filepath = createTempXmlFile(xml);
			try {
				const result = XmlTag(filepath, 5, 16);
				assert.ok(result.some((tag: [string, number]) => tag[0] === 'root'));
				assert.ok(result.some((tag: [string, number]) => tag[0] === 'child'));
			} finally {
				cleanupTempFile(filepath);
			}
		});
	});

	// Tests for edge cases
	suite('Edge Cases', () => {
		test('should ignore processing instructions (<?...?>)', () => {
			const xml = `<?xml version="1.0"?>
<?xml-stylesheet type="text/xsl" href="style.xsl"?>
<root>
	<child>content</child>
</root>`;
			const filepath = createTempXmlFile(xml);
			try {
				const result = XmlTag(filepath, 4, 16);
				assert.ok(result.some((tag: [string, number]) => tag[0] === 'root'));
				assert.ok(!result.some((tag: [string, number]) => tag[0]?.includes('xml-stylesheet')));
				assert.ok(result.some((tag: [string, number]) => tag[0] === 'child'));
				// Check line numbers
				const rootTag = result.find((tag: [string, number]) => tag[0] === 'root');
				const childTag = result.find((tag: [string, number]) => tag[0] === 'child');
				assert.strictEqual(rootTag?.[1], 3, 'Expected root tag to be on line 3');
				assert.strictEqual(childTag?.[1], 4, 'Expected child tag to be on line 4');
			} finally {
				cleanupTempFile(filepath);
			}
		});

		test('should handle deeply nested tags', () => {
			const xml = `<?xml version="1.0"?>
<root>
	<level1>
		<level2>
			<level3>
				<level4>content</level4>
			</level3>
		</level2>
	</level1>
</root>`;
			const filepath = createTempXmlFile(xml);
			try {
				const result = XmlTag(filepath, 6, 28);
				assert.strictEqual(result[0][0], 'root');
				assert.ok(result.some((tag: [string, number]) => tag[0] === 'level1'));
				assert.ok(result.some((tag: [string, number]) => tag[0] === 'level2'));
				assert.ok(result.some((tag: [string, number]) => tag[0] === 'level3'));
				assert.ok(result.some((tag: [string, number]) => tag[0] === 'level4'));
			} finally {
				cleanupTempFile(filepath);
			}
		});

		test('should handle empty tags', () => {
			const xml = `<?xml version="1.0"?>
<root>
	<empty></empty>
	<child>content</child>
</root>`;
			const filepath = createTempXmlFile(xml);
			try {
				const result = XmlTag(filepath, 3, 12);
				assert.ok(result.some((tag: [string, number]) => tag[0] === 'empty'));
			} finally {
				cleanupTempFile(filepath);
			}
		});

		test('should handle tags with hyphens and underscores', () => {
			const xml = `<?xml version="1.0"?>
<root>
	<tag-with-hyphens>content</tag-with-hyphens>
	<tag_with_underscores>content</tag_with_underscores>
</root>`;
			const filepath = createTempXmlFile(xml);
			try {
				let result = XmlTag(filepath, 3, 28);
				let tagNames = result.map((tag: [string, number]) => tag[0]);
				assert.ok(tagNames.includes('tag-with-hyphens'));

				result = XmlTag(filepath, 4, 28);
				tagNames = result.map((tag: [string, number]) => tag[0]);
				assert.ok(tagNames.includes('tag_with_underscores'));
			} finally {
				cleanupTempFile(filepath);
			}
		});

		test('should handle consecutive opening tags', () => {
			const xml = `<?xml version="1.0"?>
<root><parent><child1><child2>content</child2></child1></parent></root>`;
			const filepath = createTempXmlFile(xml);
			try {
				const result = XmlTag(filepath, 2, 34);
				assert.ok(result.some((tag: [string, number]) => tag[0] === 'root'));
				assert.ok(result.some((tag: [string, number]) => tag[0] === 'parent'));
				assert.ok(result.some((tag: [string, number]) => tag[0] === 'child1'));
				assert.ok(result.some((tag: [string, number]) => tag[0] === 'child2'));
			} finally {
				cleanupTempFile(filepath);
			}
		});
	});

	// Tests for DeepPath function
	suite('DeepPath Function', () => {
		test('should support xml filetype', () => {
			const xml = `<?xml version="1.0"?>
<root>
	<child>content</child>
</root>`;
			const filepath = createTempXmlFile(xml);
			try {
				const result = DeepPath(filepath, 'xml', 3, 16);
				assert.ok(result.length > 0);
				assert.strictEqual(result[0][0], 'root');
			} finally {
				cleanupTempFile(filepath);
			}
		});

		test('should throw error for unsupported file types', () => {
			const xml = `<?xml version="1.0"?>
<root/>`;
			const filepath = createTempXmlFile(xml);
			try {
				assert.throws(() => {
					DeepPath(filepath, 'json', 1, 1);
				}, /Unsupported file type: json/);
			} finally {
				cleanupTempFile(filepath);
			}
		});

		test('should process large buffers correctly', () => {
			const xml = `<?xml version="1.0"?>
<root>
	<child>content</child>
</root>`;
			const filepath = createTempXmlFile(xml);
			try {
				// Use smaller buffer size to test chunked reading
				const result = XmlTag(filepath, 3, 16, 1024);
				assert.ok(result.length > 0);
			} finally {
				cleanupTempFile(filepath);
			}
		});
	});

	// Integration tests
	suite('Integration Tests', () => {
		test('should handle real Android manifest snippet', () => {
			const xml = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
	package="com.example.app">
	<!-- Application configuration -->
	<uses-permission android:name="android.permission.INTERNET" />
	<application>
		<activity android:name=".MainActivity">
			<intent-filter>
				<action android:name="android.intent.action.MAIN" />
				<!-- Filter category -->
				<category android:name="android.intent.category.LAUNCHER" />
			</intent-filter>
		</activity>
	</application>
</manifest>`;
			const filepath = createTempXmlFile(xml);
			try {
				const result = XmlTag(filepath, 11, 74);
				assert.ok(result.some((tag: [string, number]) => tag[0] === 'manifest'));
				assert.ok(!result.some((tag: [string, number]) => tag[0] === 'uses-permission'));
				assert.ok(result.some((tag: [string, number]) => tag[0] === 'application'));
				assert.ok(result.some((tag: [string, number]) => tag[0] === 'activity'));
				assert.ok(result.some((tag: [string, number]) => tag[0] === 'intent-filter'));
				// Comments should not be included
				assert.ok(!result.some((tag: [string, number]) => tag[0]?.includes('Filter category')));
				assert.ok(!result.some((tag: [string, number]) => tag[0]?.includes('!--')));
				assert.ok(result.some((tag: [string, number]) => tag[0] === 'category'));
			} finally {
				cleanupTempFile(filepath);
			}
		});

		test('should handle comments mixed with real content', () => {
			const xml = `<?xml version="1.0"?>
<!-- Root element -->
<root>
	<!-- Configuration section
		 Do not modify the following tags: -->
	<config>
		<setting1>value</setting1>
		<!-- <deprecated>tag</deprecated> -->
		<setting2>value</setting2>
	</config>
	<!-- End configuration -->
</root>`;
			const filepath = createTempXmlFile(xml);
			try {
				const result = XmlTag(filepath, 8, 27);
				assert.ok(result.some((tag: [string, number]) => tag[0] === 'root'));
				assert.ok(result.some((tag: [string, number]) => tag[0] === 'config'));
				// deprecated should NOT be in the valid tags
				assert.ok(!result.some((tag: [string, number]) => tag[0] === 'deprecated'));
			} finally {
				cleanupTempFile(filepath);
			}
		});
	});
});
