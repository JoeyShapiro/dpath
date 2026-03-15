import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as vscode from 'vscode';
import { DeepPath, XmlTag, Tag } from '../dpath';

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
		test('should ignore single-line comments', () => {
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
				assert.strictEqual(result[0].name, 'root');
				assert.strictEqual(result[0].line, 2, 'Expected root tag to be on line 2');
				assert.strictEqual(result[1].name, 'valid');
				assert.strictEqual(result[1].line, 4, 'Expected valid tag to be on line 4');
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
				const validTags = result.filter((tag: Tag) => tag.name !== '!--');
				assert.strictEqual(validTags.length, 2, 'Expected only root and valid tags to be parsed');
				assert.strictEqual(validTags[0].name, 'root');
				assert.strictEqual(validTags[1].name, 'valid');
				assert.strictEqual(validTags[1].line, 7, 'Expected valid tag to be on line 7');
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
				const validTags = result.filter((tag: Tag) => tag.name !== '!--');
				assert.strictEqual(validTags.length, 2, 'Expected only root and real tags to be parsed');
				assert.strictEqual(validTags[0].name, 'root');
				assert.strictEqual(validTags[1].name, 'real');
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
				assert.strictEqual(result[0].name, 'root');
				assert.strictEqual(result[1].name, 'child');
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
				const validTags = result.filter((tag: Tag) => tag.name !== '!--');
				assert.ok(validTags.some((tag: Tag) => tag.name === 'root'));
				assert.ok(validTags.some((tag: Tag) => tag.name === 'real'));
				assert.ok(!validTags.some((tag: Tag) => tag.name === 'fake'));
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
				assert.strictEqual(result[0].name, 'root');
				assert.ok(result.some((tag: Tag) => tag.name === 'parent'));
				assert.ok(result.some((tag: Tag) => tag.name === 'child'));
				// Check line numbers
				const rootTag = result.find((tag: Tag) => tag.name === 'root');
				const parentTag = result.find((tag: Tag) => tag.name === 'parent');
				const childTag = result.find((tag: Tag) => tag.name === 'child');
				assert.strictEqual(rootTag?.line, 2, 'Expected root tag to be on line 2');
				assert.strictEqual(parentTag?.line, 3, 'Expected parent tag to be on line 3');
				assert.strictEqual(childTag?.line, 4, 'Expected child tag to be on line 4');
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
				assert.strictEqual(result[0].name, 'root');
				assert.ok(result.some((tag: Tag) => tag.name === 'child'));
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
				assert.ok(result.some((tag: Tag) => tag.name === 'root'));
				assert.ok(result.some((tag: Tag) => tag.name === 'self-closing'));

				result = XmlTag(filepath, 4, 16);
				assert.ok(result.some((tag: Tag) => tag.name === 'root'));
				assert.ok(result.some((tag: Tag) => tag.name === 'normal'));
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
				assert.ok(result.some((tag: Tag) => tag.name === 'root'));
				assert.ok(result.some((tag: Tag) => tag.name === 'child'));
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
				assert.ok(result.some((tag: Tag) => tag.name === 'root'));
				assert.ok(!result.some((tag: Tag) => tag.name?.includes('xml-stylesheet')));
				assert.ok(result.some((tag: Tag) => tag.name === 'child'));
				// Check line numbers
				const rootTag = result.find((tag: Tag) => tag.name === 'root');
				const childTag = result.find((tag: Tag) => tag.name === 'child');
				assert.strictEqual(rootTag?.line, 3, 'Expected root tag to be on line 3');
				assert.strictEqual(childTag?.line, 4, 'Expected child tag to be on line 4');
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
				assert.strictEqual(result[0].name, 'root');
				assert.ok(result.some((tag: Tag) => tag.name === 'level1'));
				assert.ok(result.some((tag: Tag) => tag.name === 'level2'));
				assert.ok(result.some((tag: Tag) => tag.name === 'level3'));
				assert.ok(result.some((tag: Tag) => tag.name === 'level4'));
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
				assert.ok(result.some((tag: Tag) => tag.name === 'empty'));
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
				let tagNames = result.map((tag: Tag) => tag.name);
				assert.ok(tagNames.includes('tag-with-hyphens'));

				result = XmlTag(filepath, 4, 28);
				tagNames = result.map((tag: Tag) => tag.name);
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
				assert.ok(result.some((tag: Tag) => tag.name === 'root'));
				assert.ok(result.some((tag: Tag) => tag.name === 'parent'));
				assert.ok(result.some((tag: Tag) => tag.name === 'child1'));
				assert.ok(result.some((tag: Tag) => tag.name === 'child2'));
			} finally {
				cleanupTempFile(filepath);
			}
		});

		test('should finish parsing tag name when cursor is in the middle', () => {
			const xml = `<?xml version="1.0"?>
<root>
	<parent>
		<child>content</child>
	</parent>
</root>`;
			const filepath = createTempXmlFile(xml);
			try {
				// Cursor is at line 4, column 12 which is in the middle of "<child>"
				// Specifically, it's after "<ch" so in the middle of "child"
				const result = XmlTag(filepath, 4, 12);
				assert.ok(result.length > 0);
				assert.ok(result.some((tag: Tag) => tag.name === 'root'));
				assert.ok(result.some((tag: Tag) => tag.name === 'parent'));
				// The critical assertion: child should be parsed even though cursor is in the middle of its name
				assert.ok(result.some((tag: Tag) => tag.name === 'child'), 
					'Expected child tag to be parsed even when cursor is in middle of tag name');
			} finally {
				cleanupTempFile(filepath);
			}
		});
	});

	// Tests for namespace handling
	suite('Namespace Handling', () => {
		test('should resolve explicit prefix namespaces for nested children', () => {
			const xml = `<?xml version="1.0"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
	<soap:Body>
		<soap:Action>ping</soap:Action>
	</soap:Body>
</soap:Envelope>`;
			const filepath = createTempXmlFile(xml);
			try {
				const result = XmlTag(filepath, 4, 20);
				assert.strictEqual(result.length, 3, 'Expected envelope, body, and action in stack');
				assert.strictEqual(result[0].name, 'soap:Envelope');
				assert.strictEqual(result[1].name, 'soap:Body');
				assert.strictEqual(result[2].name, 'soap:Action');

				const expectedUri = 'http://schemas.xmlsoap.org/soap/envelope/';
				assert.strictEqual(result[0].namespace, expectedUri, 'Expected envelope namespace URI to resolve from soap prefix');
				assert.strictEqual(result[1].namespace, expectedUri, 'Expected body namespace URI to resolve from soap prefix');
				assert.strictEqual(result[2].namespace, expectedUri, 'Expected action namespace URI to resolve from soap prefix');
			} finally {
				cleanupTempFile(filepath);
			}
		});

		test('should resolve default namespace for unprefixed nested children', () => {
			const xml = `<?xml version="1.0"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
	<dependency>
		<version>1.0</version>
	</dependency>
</project>`;
			const filepath = createTempXmlFile(xml);
			try {
				const result = XmlTag(filepath, 4, 16);
				assert.strictEqual(result.length, 3, 'Expected project, dependency, and version in stack');
				assert.strictEqual(result[0].name, 'project');
				assert.strictEqual(result[1].name, 'dependency');
				assert.strictEqual(result[2].name, 'version');

				const expectedUri = 'http://maven.apache.org/POM/4.0.0';
				assert.strictEqual(result[0].namespace, expectedUri, 'Expected project to carry default namespace URI');
				assert.strictEqual(result[1].namespace, expectedUri, 'Expected dependency to inherit default namespace URI');
				assert.strictEqual(result[2].namespace, expectedUri, 'Expected version to inherit default namespace URI');
			} finally {
				cleanupTempFile(filepath);
			}
		});

		test('should keep namespace empty when no namespace exists for nested children', () => {
			const xml = `<?xml version="1.0"?>
<root>
	<parent>
		<element/>
	</parent>
</root>`;
			const filepath = createTempXmlFile(xml);
			try {
				const result = XmlTag(filepath, 4, 11);
				assert.strictEqual(result.length, 3, 'Expected root, parent, and element in stack');
				assert.strictEqual(result[0].name, 'root');
				assert.strictEqual(result[1].name, 'parent');
				assert.strictEqual(result[2].name, 'element');

				assert.strictEqual(result[0].namespace, '', 'Expected root namespace to be empty');
				assert.strictEqual(result[1].namespace, '', 'Expected parent namespace to be empty');
				assert.strictEqual(result[2].namespace, '', 'Expected element namespace to be empty');
			} finally {
				cleanupTempFile(filepath);
			}
		});

		test('should handle multiple namespace declarations and overrides', () => {
			const xml = `<?xml version="1.0"?>
<root xmlns="http://default.com" xmlns:a="http://a.com">
	<child1>
		<child2 xmlns="http://child2.com" xmlns:a="http://a-child2.com">
			<child3/>
		</child2>
	</child1>
</root>`;
			const filepath = createTempXmlFile(xml);
			try {
				const result = XmlTag(filepath, 5, 16);
				assert.strictEqual(result.length, 4, 'Expected root, child1, child2, and child3 in stack');
				assert.strictEqual(result[0].name, 'root');
				assert.strictEqual(result[1].name, 'child1');
				assert.strictEqual(result[2].name, 'child2');
				assert.strictEqual(result[3].name, 'child3');

				assert.strictEqual(result[0].namespace, 'http://default.com', 'Expected root to have default namespace');
				assert.strictEqual(result[1].namespace, 'http://default.com', 'Expected child1 to inherit default namespace');
				assert.strictEqual(result[2].namespace, 'http://child2.com', 'Expected child2 to override default namespace');
				assert.strictEqual(result[3].namespace, 'http://child2.com', 'Expected child3 to inherit child2 namespace: got ' + result[3].namespace);
			} finally {
				cleanupTempFile(filepath);
			}
		});

		test('should handle empty namespace declarations', () => {
			const xml = `<?xml version="1.0"?>
<root xmlns="http://default.com">
	<child1>
		<child2 xmlns="">
			<child3/>
		</child2>
	</child1>
</root>`;
			const filepath = createTempXmlFile(xml);
			try {
				const result = XmlTag(filepath, 5, 16);
				assert.strictEqual(result.length, 4, 'Expected root, child1, child2, and child3 in stack');
				assert.strictEqual(result[0].name, 'root');
				assert.strictEqual(result[1].name, 'child1');
				assert.strictEqual(result[2].name, 'child2');
				assert.strictEqual(result[3].name, 'child3');

				assert.strictEqual(result[0].namespace, 'http://default.com', 'Expected root to have default namespace');
				assert.strictEqual(result[1].namespace, 'http://default.com', 'Expected child1 to inherit default namespace');
				assert.strictEqual(result[2].namespace, '', 'Expected child2 to override default namespace with empty string');
				assert.strictEqual(result[3].namespace, '', 'Expected child3 to inherit empty namespace');
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
				assert.strictEqual(result[0].name, 'root');
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
				assert.ok(result.some((tag: Tag) => tag.name === 'manifest'));
				assert.ok(!result.some((tag: Tag) => tag.name === 'uses-permission'));
				assert.ok(result.some((tag: Tag) => tag.name === 'application'));
				assert.ok(result.some((tag: Tag) => tag.name === 'activity'));
				assert.ok(result.some((tag: Tag) => tag.name === 'intent-filter'));
				// Comments should not be included
				assert.ok(!result.some((tag: Tag) => tag.name?.includes('Filter category')));
				assert.ok(!result.some((tag: Tag) => tag.name?.includes('!--')));
				assert.ok(result.some((tag: Tag) => tag.name === 'category'));
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
				const result = XmlTag(filepath, 9, 23);
				assert.ok(result.some((tag: Tag) => tag.name === 'root'));
				assert.ok(result.some((tag: Tag) => tag.name === 'config'));
				// deprecated should NOT be in the valid tags
				assert.ok(!result.some((tag: Tag) => tag.name === 'deprecated'));
			} finally {
				cleanupTempFile(filepath);
			}
		});
	});
});
