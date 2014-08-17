/*
 * Copyright (c) 2014 Adobe Systems Incorporated. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 * DEALINGS IN THE SOFTWARE.
 *
 */

/*global $, define, brackets, describe, xdescribe, it, xit, beforeEach, expect, setTimeout, waitsForDone, runs, spyOn */
/*unittests: FileTreeView*/

define(function (require, exports, module) {
    "use strict";
    
    var FileTreeView = require("project/FileTreeView"),
        React = require("thirdparty/react"),
        Immutable = require("thirdparty/immutable"),
        RTU = React.addons.TestUtils;

    describe("FileTreeView", function () {
        describe("ViewModel", function () {
            var subdir = {
                fullPath: "/path/to/project/subdir/",
                name: "subdir",
                isFile: false
            },
                contents = [
                    {
                        fullPath: "/path/to/project/README.md",
                        name: "README.md",
                        isFile: true
                    },
                    {
                        fullPath: "/path/to/project/afile.js",
                        name: "afile.js",
                        isFile: true
                    },
                    subdir
                ];
            
            describe("_formatDirectoryContents", function () {
                it("should convert file and directory objects for display", function () {
                    var result = FileTreeView._formatDirectoryContents(contents);
                    expect(result.toJS()).toEqual({
                        "README.md": {},
                        "afile.js": {},
                        "subdir": {
                            children: null
                        }
                    });
                });
                
            });
            
            describe("setProjectRoot", function () {
                var root = {
                    fullPath: "/path/to/project/",
                    getContents: function (callback) {
                        setTimeout(function () {
                            callback(null, contents);
                        }, 10);
                    }
                };
                
                it("should initialize the treeData", function () {
                    var vm = new FileTreeView.ViewModel();
                    
                    var changeFired = false;
                    vm.on(FileTreeView.CHANGE, function () {
                        changeFired = true;
                    });
                    
                    waitsForDone(vm.setProjectRoot(root));
                    
                    runs(function () {
                        expect(vm.treeData.toJS()).toEqual({
                            "README.md": {},
                            "afile.js": {},
                            "subdir": {
                                children: null
                            }
                        });
                        expect(changeFired).toBe(true);
                    });
                });
            });
            
            describe("_filePathToObjectPath", function () {
                var vm = new FileTreeView.ViewModel();
                beforeEach(function () {
                    vm.projectRoot = {
                        fullPath: "/foo/"
                    };

                    vm.treeData = Immutable.fromJS({
                        "subdir": {
                            children: {
                                "afile.js": {},
                                "subsubdir": {
                                    children: {
                                        "thirdsub": {
                                            children: {}
                                        }
                                    }
                                }
                            }
                        },
                        "anothersub": {
                            children: {}
                        }
                    });
                });
                
                it("returns null if the projectRoot isn't set", function () {
                    vm.projectRoot = null;
                    expect(vm._filePathToObjectPath("/foo/subdir/")).toBeNull();
                    delete vm.projectRoot;
                    expect(vm._filePathToObjectPath("/foo/subdir/")).toBeNull();
                });
                
                it("should find items at the root", function () {
                    expect(vm._filePathToObjectPath("/foo/subdir/")).toEqual(["subdir"]);
                    expect(vm._filePathToObjectPath("/foo/anothersub/")).toEqual(["anothersub"]);
                });
                
                it("should find nested files", function () {
                    expect(vm._filePathToObjectPath("/foo/subdir/afile.js")).toEqual(["subdir", "children", "afile.js"]);
                });
                
                it("should find nested directories", function () {
                    expect(vm._filePathToObjectPath("/foo/subdir/subsubdir/thirdsub/")).toEqual(
                        ["subdir", "children", "subsubdir", "children", "thirdsub"]
                    );
                });
            });
            
            describe("toggleDirectory", function () {
                var vm = new FileTreeView.ViewModel();
                vm.projectRoot = {
                    fullPath: "/foo/"
                };
                
                beforeEach(function () {
                    vm.treeData = Immutable.fromJS({
                        "subdir": {
                            open: true,
                            children: {
                                "afile.js": {}
                            }
                        },
                        "closedDir": {
                            children: null
                        }
                    });
                });
                
                it("should throw if the path does not exist", function () {
                    try {
                        vm.toggleDirectory("/foo/bar/");
                        expect("should have thrown an error").toBe("but it didn't");
                    } catch (e) {
                        // Do nothing. It's expected to throw an error.
                    }
                });
                
                it("should throw if it is passed a file and not a directory", function () {
                    try {
                        vm.toggleDirectory("/foo/subdir/afile.js");
                        expect("should have thrown an error").toBe("but it didn't");
                    } catch (e) {
                        // Do nothing. This is actually what we expect.
                    }
                });
                
                it("should close a directory that's open", function () {
                    var changeFired = false;
                    vm.on(FileTreeView.CHANGE, function () {
                        changeFired = true;
                    });
                    
                    waitsForDone(vm.toggleDirectory("/foo/subdir/"));
                    runs(function () {
                        expect(vm.treeData.getIn(["subdir", "open"])).toBeUndefined();
                        expect(vm.treeData.getIn(["subdir", "children"]).length).toBe(1);
                        expect(changeFired).toBe(true);
                    });
                });
                
                it("should open a directory that's closed", function () {
                    var deferred = new $.Deferred();
                    spyOn(FileTreeView, "_getDirectoryContents").andReturn(deferred.resolve({}).promise());
                    vm.toggleDirectory("/foo/closedDir/");
                    expect(FileTreeView._getDirectoryContents).toHaveBeenCalledWith("/foo/closedDir/");
                    expect(vm.treeData.get("closedDir").toJS()).toEqual({
                        open: true,
                        children: {}
                    });
                });
                
                it("should not rerequest subdirectories", function () {
                    var changeFired = false;
                    vm.on(FileTreeView.CHANGE, function () {
                        changeFired = true;
                    });
                    
                    var childrenObject;
                    
                    spyOn(FileTreeView, "_getDirectoryContents").andReturn(new $.Deferred().resolve({}).promise());

                    waitsForDone(vm.toggleDirectory("/foo/subdir/"));
                    runs(function () {
                        changeFired = false;
                        childrenObject = vm.treeData.getIn(["subdir", "children"]);
                        waitsForDone(vm.toggleDirectory("/foo/subdir/"));
                    });
                    runs(function () {
                        expect(changeFired).toBe(true);
                        expect(vm.treeData.getIn(["subdir", "children"])).toBe(childrenObject);
                        expect(FileTreeView._getDirectoryContents).not.toHaveBeenCalled();
                    });
                });
            });
            
            describe("_getOpenNodes", function () {
                var vm;
                
                beforeEach(function () {
                    vm = new FileTreeView.ViewModel();
                    
                    vm.projectRoot = {
                        fullPath: "/foo/bar/"
                    };
                });
                
                it("should return an empty list when there are no open nodes", function () {
                    vm.treeData = Immutable.fromJS({
                        file: {},
                        subdir: {
                            children: null
                        }
                    });
                    expect(vm._getOpenNodes()).toEqual([]);
                });
                
                it("should return open directories grouped by level", function () {
                    vm.treeData = Immutable.fromJS({
                        subdir1: {
                            open: true,
                            children: {
                                subsubdir: {
                                    children: {},
                                    open: true
                                }
                            }
                        },
                        subdir2: {
                            children: null
                        },
                        subdir3: {
                            open: true,
                            children: {}
                        }
                    });
                    expect(vm._getOpenNodes()).toEqual([
                        [
                            "/foo/bar/subdir1/",
                            "/foo/bar/subdir3/"
                        ],
                        [
                            "/foo/bar/subdir1/subsubdir/"
                        ]
                    ]);
                });
            });
            
            describe("_setSelected", function () {
                var vm = new FileTreeView.ViewModel(),
                    changed;
                
                vm.projectRoot = {
                    fullPath: "/foo/"
                };
                
                vm.on(FileTreeView.CHANGE, function () {
                    changed = true;
                });
                
                beforeEach(function () {
                    changed = false;
                    vm.treeData = Immutable.fromJS({
                        subdir1: {
                            open: true,
                            children: {
                                "afile.js": {}
                            }
                        },
                        "afile.js": {}
                    });
                });
                
                it("should select an unselected file", function () {
                    vm._setSelected("/foo/afile.js");
                    expect(vm.treeData.getIn(["afile.js", "selected"])).toBe(true);
                    expect(changed).toBe(true);
                });
                
                it("should change the selection from the old to the new", function () {
                    vm._setSelected("/foo/afile.js");
                    changed = false;
                    vm._setSelected("/foo/subdir1/afile.js");
                    expect(vm.treeData.getIn(["afile.js", "selected"])).toBe(undefined);
                    expect(vm.treeData.getIn(["subdir1", "children", "afile.js", "selected"])).toBe(true);
                    expect(changed).toBe(true);
                });
                
                it("shouldn't fire a changed message if there was no change in selection", function () {
                    vm._setSelected("/foo/afile.js");
                    expect(changed).toBe(true);
                    changed = false;
                    vm._setSelected("/foo/afile.js");
                    expect(changed).toBe(false);
                });
            });
        });
        
        describe("_splitExtension", function () {
            it("should work for plain filenames", function () {
                expect(FileTreeView._splitExtension("afile.js")).toEqual({
                    name: "afile",
                    extension: ".js"
                });
            });

            it("should treat dotfiles as filenames and not extensions", function () {
                var result = FileTreeView._splitExtension(".dotfile");
                expect(result).toEqual({
                    name: ".dotfile",
                    extension: ""
                });
            });
        });

        describe("_fileNode", function () {
            it("should create a component with the right information", function () {
                var rendered = RTU.renderIntoDocument(FileTreeView._fileNode({
                    name: "afile.js"
                }));
                var a = RTU.findRenderedDOMComponentWithTag(rendered, "a");
                expect(a.props.children[0]).toBe("afile");
                expect(a.props.children[1].props.children).toBe(".js");
            });
        });
        
        describe("_sortFormattedDirectory", function () {
            it("should sort alphabetically", function () {
                var formatted = Immutable.fromJS({
                    "README.md": {},
                    "afile.js": {},
                    subdir: {
                        children: null
                    }
                });
                expect(FileTreeView._sortFormattedDirectory(formatted).toJS()).toEqual([
                    "afile.js", "README.md", "subdir"
                ]);
            });

            it("should include the extension in the sort", function () {
                var formatted = Immutable.fromJS({
                    "README.txt": {},
                    "README.md": {},
                    "README": {}
                });
                expect(FileTreeView._sortFormattedDirectory(formatted).toJS()).toEqual([
                    "README", "README.md", "README.txt"
                ]);
            });

            it("can sort by directories first", function () {
                var formatted = Immutable.fromJS({
                    "README.md": {},
                    "afile.js": {},
                    subdir: {
                        children: null
                    }
                });
                expect(FileTreeView._sortFormattedDirectory(formatted, true).toJS()).toEqual([
                    "subdir", "afile.js", "README.md"
                ]);
            });
        });

        var twoLevel = Immutable.fromJS({
            open: true,
            children: {
                subdir: {
                    open: true,
                    children: {
                        "afile.js": {}
                    }
                }
            }
        });

        describe("_directoryNode and _directoryContents", function () {
            it("should format a closed directory", function () {
                var rendered = RTU.renderIntoDocument(FileTreeView._directoryNode({
                    name: "thedir",
                    entry: Immutable.fromJS({
                        children: null
                    })
                }));
                var dirLI = RTU.findRenderedDOMComponentWithClass(rendered, "jstree-closed"),
                    dirA = RTU.findRenderedDOMComponentWithTag(dirLI, "a");
                expect(dirA.props.children[1]).toBe("thedir");
            });
            
            it("should be able to list files", function () {
                var rendered = RTU.renderIntoDocument(FileTreeView._directoryContents({
                    contents: Immutable.fromJS({
                        "afile.js": {}
                    })
                }));
                var fileLI = RTU.findRenderedDOMComponentWithClass(rendered, "jstree-leaf"),
                    fileA = RTU.findRenderedDOMComponentWithTag(fileLI, "a");
                expect(fileA.props.children[0]).toBe("afile");
            });
            
            it("should be able to list closed directories", function () {
                var rendered = RTU.renderIntoDocument(FileTreeView._directoryNode({
                    name: "thedir",
                    entry: Immutable.fromJS({
                        open: true,
                        children: {
                            "subdir": {
                                children: null
                            }
                        }
                    })
                }));
                
                var subdirLI = RTU.findRenderedDOMComponentWithClass(rendered, "jstree-closed"),
                    subdirA = RTU.findRenderedDOMComponentWithTag(subdirLI, "a");
                expect(subdirA.props.children[1]).toBe("subdir");
            });
            
            it("should be able to list open subdirectories", function () {
                var rendered = RTU.renderIntoDocument(FileTreeView._directoryNode({
                    name: "twoLevel",
                    entry: twoLevel
                }));
                var dirLIs = RTU.scryRenderedDOMComponentsWithClass(rendered, "jstree-open");
                expect(dirLIs.length).toBe(2);
                var subdirLI = dirLIs[1],
                    aTags = RTU.scryRenderedDOMComponentsWithTag(subdirLI, "a");
                expect(aTags.length).toBe(2);
                expect(aTags[0].props.children[1]).toBe("subdir");
                expect(aTags[1].props.children[0]).toBe("afile");
            });
        });
        
        describe("_fileTreeView", function () {
            it("should render the directory", function () {
                var rendered = RTU.renderIntoDocument(FileTreeView._fileTreeView({
                    viewModel: {
                        projectRoot: {},
                        treeData: new Immutable.Map({
                            "subdir": twoLevel.getIn(["children", "subdir"])
                        })
                    }
                })),
                    rootNode = RTU.findRenderedDOMComponentWithClass(rendered, "jstree-no-dots"),
                    aTags = RTU.scryRenderedDOMComponentsWithTag(rootNode, "a");
                expect(aTags.length).toBe(2);
                expect(aTags[0].props.children[1]).toBe("subdir");
                expect(aTags[1].props.children[0]).toBe("afile");
            });
        });
        
        describe("render", function () {
            it("should render into the given element", function () {
                var el = document.createElement("div"),
                    viewModel = new FileTreeView.ViewModel();
                viewModel.treeData = new Immutable.Map({
                    "subdir": twoLevel.getIn(["children", "subdir"])
                });
                viewModel.projectRoot = {};
                FileTreeView.render(el, viewModel);
                expect($(el).hasClass("jstree")).toBe(true);
                expect($(".jstree-no-dots", el).length).toBe(1);
            });
        });
    });
});